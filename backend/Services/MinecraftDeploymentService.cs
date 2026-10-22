using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class MinecraftDeploymentService : IMinecraftDeploymentService
{
    private readonly ISshService _sshService;
    private readonly ILogger<MinecraftDeploymentService> _logger;
    private readonly HttpClient _httpClient;

    public MinecraftDeploymentService(ISshService sshService, ILogger<MinecraftDeploymentService> logger, HttpClient httpClient)
    {
        _sshService = sshService;
        _logger = logger;
        _httpClient = httpClient;
    }

    public async Task<List<DeploymentLog>> DeployClusterAsync(
        ClusterConfig clusterConfig, 
        bool installJavaIfMissing,
        Action<DeploymentLog>? onProgress = null)
    {
        var logs = new List<DeploymentLog>();

        // 1. First deploy backend servers (Lobby, Overworld, Nether, End)
        var backendNodes = clusterConfig.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        foreach (var node in backendNodes)
        {
            var nodeLogs = await DeployNodeAsync(node, clusterConfig, installJavaIfMissing, onProgress);
            logs.AddRange(nodeLogs);
        }

        // 2. Deploy Waterfall Proxy configured with all nodes
        var proxyNode = clusterConfig.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy);
        if (proxyNode != null)
        {
            var proxyLogs = await DeployNodeAsync(proxyNode, clusterConfig, installJavaIfMissing, onProgress);
            logs.AddRange(proxyLogs);
        }

        return logs;
    }

    public async Task<List<DeploymentLog>> DeployNodeAsync(
        ClusterNode node, 
        ClusterConfig clusterConfig, 
        bool installJavaIfMissing,
        Action<DeploymentLog>? onProgress = null)
    {
        var logs = new List<DeploymentLog>();

        void AddLog(string step, bool success, string output)
        {
            var entry = new DeploymentLog
            {
                NodeId = node.Id,
                Step = step,
                Success = success,
                Output = output,
                Timestamp = DateTime.UtcNow
            };
            logs.Add(entry);
            onProgress?.Invoke(entry);
        }

        node.Status = NodeStatus.Deploying;
        AddLog("Initialisierung", true, $"Bereitstellung für Server '{node.Name}' ({node.Role}) auf {node.Host} gestartet...");

        // Step 1: Check SSH
        var sshTest = await _sshService.TestConnectionAsync(node);
        if (!sshTest.Success)
        {
            AddLog("SSH-Verbindung", false, $"SSH-Verbindung fehlgeschlagen: {sshTest.Message}");
            node.Status = NodeStatus.Error;
            node.LastError = sshTest.Message;
            return logs;
        }
        AddLog("SSH-Verbindung", true, $"SSH erreichbar. System: {sshTest.OsInfo}");

        // Step 2: Java Runtime
        if (!sshTest.JavaInstalled)
        {
            if (installJavaIfMissing)
            {
                AddLog("Java-Installation", true, "Java nicht gefunden. Installiere OpenJDK 21 via apt/dnf...");
                var packageInstall = "DEBIAN_FRONTEND=noninteractive apt-get update -y && (DEBIAN_FRONTEND=noninteractive apt-get install -y openjdk-21-jre-headless screen curl wget || DEBIAN_FRONTEND=noninteractive apt-get install -y default-jre-headless screen curl wget) || dnf install -y java-21-openjdk-headless screen curl wget";
                var installCmd = WrapPrivilegedCommand(node, packageInstall);
                var (exitCode, stdOut, stdErr) = await _sshService.ExecuteCommandAsync(node, installCmd, 300);
                if (exitCode != 0)
                {
                    AddLog("Java-Installation", false, $"Fehler bei der Java-Installation: {stdErr}\n{stdOut}");
                    node.Status = NodeStatus.Error;
                    node.LastError = "Java-Installation fehlgeschlagen";
                    return logs;
                }
                AddLog("Java-Installation", true, "OpenJDK 21 und Screen wurden erfolgreich installiert.");
            }
            else
            {
                AddLog("Java-Installation", false, "Java ist nicht installiert und automatische Installation wurde deaktiviert.");
                node.Status = NodeStatus.Error;
                node.LastError = "Java fehlt";
                return logs;
            }
        }
        else
        {
            AddLog("Java-Prüfung", true, $"Vorhandene Java-Version: {sshTest.JavaVersion}");
        }

        // Step 3: Ensure Screen tool is present
        if (!sshTest.ScreenOrTmuxInstalled)
        {
            AddLog("Paketverwaltung", true, "Installiere Screen-Dienst zur Hintergrundsteuerung...");
            var screenCmd = WrapPrivilegedCommand(node, "DEBIAN_FRONTEND=noninteractive apt-get install -y screen || dnf install -y screen");
            await _sshService.ExecuteCommandAsync(node, screenCmd, 60);
        }

        // Step 4: Create Directory
        var remoteDir = node.RemoteDirectory.TrimEnd('/');
        var dirCmd = WrapPrivilegedCommand(node, $"mkdir -p '{remoteDir}/logs' && chmod -R 777 '{remoteDir}' && (chown -R {node.SshUsername}:{node.SshUsername} '{remoteDir}' 2>/dev/null || true)");
        await _sshService.ExecuteCommandAsync(node, dirCmd, 15);
        AddLog("Verzeichnis", true, $"Arbeitsverzeichnis {remoteDir} erstellt.");

        // Step 5: Download Server Jar
        var jarUrl = await ResolveDownloadUrlAsync(node);
        AddLog("Download", true, $"Lade {node.ServerType} Jar herunter: {jarUrl}");
        var downloadCmd = $"curl -fSL -A 'McWaterfall/1.0 (admin@example.com)' -o '{remoteDir}/server.jar' '{jarUrl}' || wget -q --user-agent='McWaterfall/1.0' -O '{remoteDir}/server.jar' '{jarUrl}'";
        var dlRes = await _sshService.ExecuteCommandAsync(node, downloadCmd, 180);
        if (dlRes.ExitCode != 0)
        {
            AddLog("Download", false, $"Download fehlgeschlagen: {dlRes.StdErr}");
            node.Status = NodeStatus.Error;
            node.LastError = "Jar-Download fehlgeschlagen";
            return logs;
        }
        AddLog("Download", true, "Server-Jar erfolgreich heruntergeladen.");

        // Step 6: Write Configurations
        if (node.Role == ServerRole.WaterfallProxy)
        {
            var configYml = GenerateWaterfallConfig(clusterConfig, node);
            await _sshService.UploadTextFileAsync(node, $"{remoteDir}/config.yml", configYml);
            AddLog("Konfiguration", true, "Waterfall config.yml mit allen Dimensions-Servern synchronisiert.");
        }
        else
        {
            // Paper / Backend Server
            var eula = "# Accepted via Dimensional Waterfall Cluster\neula=true\n";
            await _sshService.UploadTextFileAsync(node, $"{remoteDir}/eula.txt", eula);

            var serverProps = GenerateServerProperties(node);
            await _sshService.UploadTextFileAsync(node, $"{remoteDir}/server.properties", serverProps);

            var spigotYml = GenerateSpigotConfig(node);
            await _sshService.UploadTextFileAsync(node, $"{remoteDir}/spigot.yml", spigotYml);

            var paperConfig = GeneratePaperGlobalConfig(node);
            await _sshService.UploadTextFileAsync(node, $"{remoteDir}/config/paper-global.yml", paperConfig);

            AddLog("Konfiguration", true, $"server.properties, spigot.yml (BungeeCord=true) und eula.txt für {node.Role} geschrieben.");
        }

        // Step 7: Create Run & Stop scripts
        var runScript = GenerateRunScript(node);
        await _sshService.UploadTextFileAsync(node, $"{remoteDir}/run.sh", runScript);
        var stopScript = GenerateStopScript(node);
        await _sshService.UploadTextFileAsync(node, $"{remoteDir}/stop.sh", stopScript);
        await _sshService.ExecuteCommandAsync(node, $"chmod +x '{remoteDir}/run.sh' '{remoteDir}/stop.sh'", 10);
        AddLog("Startskripte", true, "Ausführbare Skripte 'run.sh' und 'stop.sh' eingerichtet.");

        // Step 8: Start the node
        AddLog("Startvorgang", true, $"Starte {node.Name} im Hintergrund...");
        var startRes = await _sshService.ExecuteCommandAsync(node, $"cd '{remoteDir}' && ./run.sh", 20);
        AddLog("Startvorgang", true, startRes.StdOut.Trim());

        // Step 9: Verify running process
        await Task.Delay(2000);
        var checkRunningCmd = $"screen -list | grep 'mc_{node.Id}' || ps aux | grep 'server.jar' | grep '{node.Id}'";
        var checkRes = await _sshService.ExecuteCommandAsync(node, checkRunningCmd, 10);

        if (!string.IsNullOrWhiteSpace(checkRes.StdOut))
        {
            node.Status = NodeStatus.Online;
            node.LastError = null;
            AddLog("Bereitstellung abgeschlossen", true, $"Server '{node.Name}' läuft aktiv auf Port {node.MinecraftPort}!");
        }
        else
        {
            node.Status = NodeStatus.Starting;
            AddLog("Bereitstellung abgeschlossen", true, $"Server '{node.Name}' wurde gestartet (Initialisierung läuft im Hintergrund).");
        }

        return logs;
    }

    private static readonly System.Collections.Concurrent.ConcurrentDictionary<ServerType, (DateTime CachedAt, List<string> Versions)> _versionCache = new();

    public async Task<List<string>> GetAvailableVersionsAsync(ServerType serverType)
    {
        if (_versionCache.TryGetValue(serverType, out var cached) && (DateTime.UtcNow - cached.CachedAt).TotalMinutes < 30)
        {
            return cached.Versions;
        }

        const string userAgent = "McWaterfall/1.0 (admin@example.com)";
        var versions = new List<string>();

        try
        {
            if (serverType == ServerType.Waterfall)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://fill.papermc.io/v3/projects/waterfall");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("versions", out var versObj))
                    {
                        foreach (var prop in versObj.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in prop.Value.EnumerateArray())
                                {
                                    var v = item.GetString();
                                    if (!string.IsNullOrWhiteSpace(v) && !versions.Contains(v))
                                    {
                                        versions.Add(v);
                                    }
                                }
                            }
                        }
                    }
                }
            }
            else if (serverType == ServerType.Purpur)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://api.purpurmc.org/v2/purpur");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("versions", out var versArr) && versArr.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var item in versArr.EnumerateArray())
                        {
                            var v = item.GetString();
                            if (!string.IsNullOrWhiteSpace(v) && !v.Contains("-pre") && !v.Contains("-rc") && !versions.Contains(v))
                            {
                                versions.Add(v);
                            }
                        }
                        versions.Reverse(); // Newest first
                    }
                }
            }
            else // PaperMC (default)
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://fill.papermc.io/v3/projects/paper");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("versions", out var versObj))
                    {
                        foreach (var prop in versObj.EnumerateObject())
                        {
                            if (prop.Value.ValueKind == JsonValueKind.Array)
                            {
                                foreach (var item in prop.Value.EnumerateArray())
                                {
                                    var v = item.GetString();
                                    if (!string.IsNullOrWhiteSpace(v) && !v.Contains("-pre") && !v.Contains("-rc") && !versions.Contains(v))
                                    {
                                        versions.Add(v);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to fetch versions for {ServerType} from API", serverType);
        }

        // Robust fallbacks if external API fails
        if (versions.Count == 0)
        {
            if (serverType == ServerType.Waterfall)
            {
                versions = new List<string> { "1.21", "1.20", "1.19", "1.18", "1.17", "1.16", "1.15", "1.14", "1.13", "1.12", "1.11" };
            }
            else if (serverType == ServerType.Purpur)
            {
                versions = new List<string> { "1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4" };
            }
            else
            {
                versions = new List<string> { "1.21.4", "1.21.3", "1.21.1", "1.21", "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.19.4", "1.18.2", "1.17.1", "1.16.5" };
            }
        }

        _versionCache[serverType] = (DateTime.UtcNow, versions);
        return versions;
    }

    public async Task<string> ResolveDownloadUrlForVersionAsync(ServerType serverType, string version)
    {
        const string userAgent = "McWaterfall/1.0 (admin@example.com)";

        if (serverType == ServerType.Waterfall)
        {
            var v = string.IsNullOrWhiteSpace(version) ? "1.21" : version.Trim();
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/waterfall/versions/{v}");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("builds", out var builds) && builds.GetArrayLength() > 0)
                    {
                        var latestBuild = builds[0].GetInt32();
                        using var buildReq = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/waterfall/versions/{v}/builds/{latestBuild}");
                        buildReq.Headers.Add("User-Agent", userAgent);
                        var buildRes = await _httpClient.SendAsync(buildReq);
                        if (buildRes.IsSuccessStatusCode)
                        {
                            var buildDoc = await buildRes.Content.ReadFromJsonAsync<JsonElement>();
                            if (buildDoc.TryGetProperty("downloads", out var dl) && dl.TryGetProperty("server:default", out var srv))
                            {
                                var directUrl = srv.GetProperty("url").GetString();
                                if (!string.IsNullOrWhiteSpace(directUrl)) return directUrl;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve Waterfall version {Version} from Fill API, using fallback", v);
            }

            return "https://fill-data.papermc.io/v1/objects/5eda8bfd0691e5088701f87020c68964299586df0faba289a634122d282d598c/waterfall-1.21-615.jar";
        }
        else if (serverType == ServerType.Purpur)
        {
            var v = string.IsNullOrWhiteSpace(version) ? "1.21.4" : version.Trim();
            return $"https://api.purpurmc.org/v2/purpur/{v}/latest/download";
        }
        else
        {
            // PaperMC
            var v = string.IsNullOrWhiteSpace(version) ? "1.21.4" : version.Trim();
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/paper/versions/{v}");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("builds", out var builds) && builds.GetArrayLength() > 0)
                    {
                        var latestBuild = builds[0].GetInt32();
                        using var buildReq = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/paper/versions/{v}/builds/{latestBuild}");
                        buildReq.Headers.Add("User-Agent", userAgent);
                        var buildRes = await _httpClient.SendAsync(buildReq);
                        if (buildRes.IsSuccessStatusCode)
                        {
                            var buildDoc = await buildRes.Content.ReadFromJsonAsync<JsonElement>();
                            if (buildDoc.TryGetProperty("downloads", out var dl) && dl.TryGetProperty("server:default", out var srv))
                            {
                                var directUrl = srv.GetProperty("url").GetString();
                                if (!string.IsNullOrWhiteSpace(directUrl)) return directUrl;
                            }
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to resolve Paper version {Version} from Fill API, using fallback", v);
            }

            return "https://fill-data.papermc.io/v1/objects/5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc/paper-1.21.4-232.jar";
        }
    }

    private async Task<string> ResolveDownloadUrlAsync(ClusterNode node)
    {
        return await ResolveDownloadUrlForVersionAsync(node.ServerType, node.MinecraftVersion);
    }

    public async Task<UpdateNodeVersionResult> UpdateNodeJarAsync(ClusterNode node, string targetVersion, bool restartAfterUpdate = true)
    {
        var result = new UpdateNodeVersionResult
        {
            PreviousVersion = node.MinecraftVersion,
            NewVersion = targetVersion
        };

        if (string.IsNullOrWhiteSpace(targetVersion))
        {
            result.Success = false;
            result.Message = "Keine Zielversion angegeben.";
            return result;
        }

        // Step 1: Verify SSH connection
        var sshTest = await _sshService.TestConnectionAsync(node);
        if (!sshTest.Success)
        {
            result.Success = false;
            result.Message = $"SSH-Verbindung fehlgeschlagen: {sshTest.Message}";
            return result;
        }

        var sessionName = $"mc_{node.Id}";
        var remoteDir = node.RemoteDirectory.TrimEnd('/');

        // Step 2: Check if server is currently running
        var checkRunningCmd = $"screen -list | grep -q \"\\.{sessionName}[[:space:]]\"";
        var runCheck = await _sshService.ExecuteCommandAsync(node, checkRunningCmd, 10);
        bool wasRunning = runCheck.ExitCode == 0;

        // Step 3: Stop server if running
        if (wasRunning)
        {
            _logger.LogInformation("Node {NodeName} is running. Stopping before version update...", node.Name);
            var stopScript = GenerateStopScript(node);
            await _sshService.ExecuteCommandAsync(node, stopScript, 25);
            await Task.Delay(4000);
        }

        // Step 4: Resolve download URL
        var jarUrl = await ResolveDownloadUrlForVersionAsync(node.ServerType, targetVersion);
        _logger.LogInformation("Updating node {NodeName} to {TargetVersion} via {JarUrl}", node.Name, targetVersion, jarUrl);

        // Step 5: Backup existing server.jar
        var backupCmd = $"if [ -f '{remoteDir}/server.jar' ]; then cp -f '{remoteDir}/server.jar' '{remoteDir}/server.jar.bak'; fi";
        await _sshService.ExecuteCommandAsync(node, backupCmd, 15);

        // Step 6: Download new jar
        var downloadCmd = $"curl -fSL -A 'McWaterfall/1.0 (admin@example.com)' -o '{remoteDir}/server.jar' '{jarUrl}' || wget -q --user-agent='McWaterfall/1.0' -O '{remoteDir}/server.jar' '{jarUrl}'";
        var dlRes = await _sshService.ExecuteCommandAsync(node, downloadCmd, 180);

        if (dlRes.ExitCode != 0)
        {
            _logger.LogError("Download of version {TargetVersion} failed for node {NodeName}: {Error}", targetVersion, node.Name, dlRes.StdErr);
            // Restore previous jar
            await _sshService.ExecuteCommandAsync(node, $"if [ -f '{remoteDir}/server.jar.bak' ]; then cp -f '{remoteDir}/server.jar.bak' '{remoteDir}/server.jar'; fi", 15);
            if (wasRunning && restartAfterUpdate)
            {
                var runScript = GenerateRunScript(node);
                await _sshService.UploadTextFileAsync(node, $"{remoteDir}/run.sh", runScript);
                await _sshService.ExecuteCommandAsync(node, $"chmod +x '{remoteDir}/run.sh' && '{remoteDir}/run.sh'", 20);
            }

            result.Success = false;
            result.Message = $"Download der Version {targetVersion} fehlgeschlagen: {dlRes.StdErr}";
            return result;
        }

        // Step 7: Update node version property
        node.MinecraftVersion = targetVersion;

        // Step 8: Update run.sh with appropriate JVM options
        var newRunScript = GenerateRunScript(node);
        await _sshService.UploadTextFileAsync(node, $"{remoteDir}/run.sh", newRunScript);
        await _sshService.ExecuteCommandAsync(node, $"chmod +x '{remoteDir}/run.sh'", 10);

        // Step 9: Restart if requested & was running
        if (wasRunning && restartAfterUpdate)
        {
            _logger.LogInformation("Restarting node {NodeName} after version update...", node.Name);
            await _sshService.ExecuteCommandAsync(node, $"cd '{remoteDir}' && ./run.sh", 20);
            result.Message = $"Server '{node.Name}' erfolgreich auf Version {targetVersion} aktualisiert und neugestartet.";
        }
        else
        {
            result.Message = $"Server '{node.Name}' erfolgreich auf Version {targetVersion} aktualisiert.";
        }

        result.Success = true;
        return result;
    }

    public string GenerateWaterfallConfig(ClusterConfig clusterConfig, ClusterNode proxyNode)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Dimensional Waterfall Cluster Proxy Configuration");
        sb.AppendLine("# Automatically generated by McWaterfall Manager");
        sb.AppendLine();
        sb.AppendLine("listeners:");
        sb.AppendLine($"- query_port: {proxyNode.MinecraftPort}");
        sb.AppendLine("  motd: '&b&lWaterfall Dimension Cluster &8| &aHigh-Performance Multi-Server'");
        sb.AppendLine("  tab_list: GLOBAL_PING");
        sb.AppendLine("  query_enabled: true");
        sb.AppendLine("  proxy_protocol: false");
        sb.AppendLine("  forced_hosts: {}");
        sb.AppendLine("  ping_passthrough: false");
        sb.AppendLine("  priorities:");

        // Priorities: Lobby first, then Overworld, then others
        var lobbyNode = clusterConfig.Nodes.FirstOrDefault(n => n.Role == ServerRole.Lobby);
        var overworldNode = clusterConfig.Nodes.FirstOrDefault(n => n.Role == ServerRole.Overworld);

        if (lobbyNode != null) sb.AppendLine($"  - {SanitizeServerName(lobbyNode.Name, "lobby")}");
        if (overworldNode != null) sb.AppendLine($"  - {SanitizeServerName(overworldNode.Name, "overworld")}");

        foreach (var node in clusterConfig.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy && n != lobbyNode && n != overworldNode))
        {
            sb.AppendLine($"  - {SanitizeServerName(node.Name, node.Role.ToString().ToLowerInvariant())}");
        }

        sb.AppendLine("  bind_local_address: true");
        sb.AppendLine($"  host: 0.0.0.0:{proxyNode.MinecraftPort}");
        sb.AppendLine("  max_players: 500");
        sb.AppendLine("  tab_size: 60");
        sb.AppendLine("  force_default_server: true");
        sb.AppendLine();
        sb.AppendLine("remote_ping_cache: -1");
        sb.AppendLine("network_compression_threshold: 256");
        sb.AppendLine("permissions:");
        sb.AppendLine("  default:");
        sb.AppendLine("  - bungeecord.command.server");
        sb.AppendLine("  - bungeecord.command.list");
        sb.AppendLine("  admin:");
        sb.AppendLine("  - bungeecord.command.alert");
        sb.AppendLine("  - bungeecord.command.end");
        sb.AppendLine("  - bungeecord.command.ip");
        sb.AppendLine("  - bungeecord.command.reload");
        sb.AppendLine("timeout: 30000");
        sb.AppendLine("online_mode: true");
        sb.AppendLine("log_commands: false");
        sb.AppendLine("ip_forward: true");
        sb.AppendLine();
        sb.AppendLine("servers:");

        var backendNodes = clusterConfig.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        if (backendNodes.Count == 0)
        {
            // Add fallback demo servers if none exist yet
            sb.AppendLine("  lobby:");
            sb.AppendLine("    motd: '&aLobby Dimension'");
            sb.AppendLine("    address: 127.0.0.1:25566");
            sb.AppendLine("    restricted: false");
        }
        else
        {
            foreach (var node in backendNodes)
            {
                var sName = SanitizeServerName(node.Name, node.Role.ToString().ToLowerInvariant());
                var hostIp = string.IsNullOrWhiteSpace(node.Host) || node.Host == "localhost" ? "127.0.0.1" : node.Host;
                sb.AppendLine($"  {sName}:");
                sb.AppendLine($"    motd: '{node.Motd}'");
                sb.AppendLine($"    address: {hostIp}:{node.MinecraftPort}");
                sb.AppendLine("    restricted: false");
            }
        }

        return sb.ToString();
    }

    public string GenerateServerProperties(ClusterNode node)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# Minecraft Server Properties - Dimensional Cluster");
        sb.AppendLine("# Configured for Waterfall Proxy Forwarding");
        sb.AppendLine($"server-port={node.MinecraftPort}");
        sb.AppendLine("server-ip=");
        sb.AppendLine("online-mode=false"); // Waterfall handles online auth!
        sb.AppendLine($"motd={node.Motd}");
        sb.AppendLine("network-compression-threshold=256");
        sb.AppendLine("enable-rcon=false");
        sb.AppendLine("white-list=true");
        sb.AppendLine("enforce-whitelist=true");
        sb.AppendLine("spawn-protection=0");
        sb.AppendLine("view-distance=10");
        sb.AppendLine("simulation-distance=8");
        sb.AppendLine("sync-chunk-writes=true");

        // Dimension specific level name
        var levelName = node.Role switch
        {
            ServerRole.Nether => "world_nether",
            ServerRole.End => "world_the_end",
            ServerRole.Lobby => "world_lobby",
            _ => "world"
        };
        sb.AppendLine($"level-name={levelName}");

        if (node.Role == ServerRole.Nether)
        {
            sb.AppendLine("allow-nether=true");
        }

        return sb.ToString();
    }

    public string GenerateSpigotConfig(ClusterNode node, string? customKickMessage = null)
    {
        var kickMsg = !string.IsNullOrWhiteSpace(customKickMessage)
            ? customKickMessage
            : "§cBitte verifiziere dich zuerst über Discord OAuth2!";

        return $@"# Spigot configuration for Waterfall Dimension Cluster
config-version: 12
settings:
  bungeecord: true
  save-user-cache-on-stop-only: false
  sample-count: 12
  player-shuffle: 0
  user-cache-size: 1000
messages:
  whitelist: ""{kickMsg}""
  unknown-command: ""Unknown command""
  server-full: ""The server is full!""
  outdated-client: ""Outdated client! Please use {{0}}""
  outdated-server: ""Outdated server! I'm still on {{0}}""
  restart: ""Server is restarting""
advancements:
  disable-saving: false
  disabled:
  - '*'
world-settings:
  default:
    verbose: false
    view-distance: default
    simulation-distance: default
";
    }

    public string GeneratePaperGlobalConfig(ClusterNode node)
    {
        return @"# Paper Global Configuration
_version: 29
proxies:
  bungee-cord:
    online-mode: true
  velocity:
    enabled: false
    online-mode: false
    secret: ''
chunk-system:
  worker-threads: -1
  io-threads: -1
";
    }

    public string GenerateRunScript(ClusterNode node)
    {
        var ram = node.MemoryAllocationMb > 0 ? node.MemoryAllocationMb : 4096;
        var sessionName = $"mc_{node.Id}";
        
        // High-Performance Multi-Core & Aikar's G1GC Flags:
        // -XX:+UseG1GC with parallel threads distributes garbage collection across all CPU cores
        // -Dpaper.use-simd=true enables AVX2/SIMD vector math across multiple cores
        var jvmFlags = $"-Xms{ram}M -Xmx{ram}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -XX:G1NewSizePercent=30 -XX:G1MaxNewSizePercent=40 -XX:G1ReservePercent=20 -XX:InitiatingHeapOccupancyPercent=15 -XX:G1MixedGCLiveThresholdPercent=90 -XX:G1RSetUpdatingPauseTimePercent=5 -XX:SurvivorRatio=32 -XX:+PerfDisableSharedMem -XX:MaxTenuringThreshold=1 -Dusing.aikars.flags=https://mcflags.emc.gs -Dpaper.use-simd=true";
        
        return $@"#!/usr/bin/env bash
# Start script for {node.Name} ({node.Role})
cd ""$(dirname ""$0"")""

SESSION=""{sessionName}""
screen -wipe 2>/dev/null

if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
    echo ""Server {node.Name} laeuft bereits in Screen-Session '${{SESSION}}'.""
    exit 0
fi

echo ""Starte {node.Name} mit {ram}MB RAM (Multi-Core Optimierung aktiv)...""
screen -dmS ""${{SESSION}}"" java {jvmFlags} -jar server.jar nogui

sleep 2
if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
    echo ""Server erfolgreich im Screen '${{SESSION}}' gestartet.""
else
    echo ""Warnung: Prozess konnte nicht sofort bestaetigt werden.""
fi
";
    }

    public string GenerateStopScript(ClusterNode node)
    {
        var sessionName = $"mc_{node.Id}";
        var stopCmd = node.Role == ServerRole.WaterfallProxy ? "end" : "stop";

        return $@"#!/usr/bin/env bash
# Stop script for {node.Name}
SESSION=""{sessionName}""

if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
    echo ""Sende Stopp-Befehl an '${{SESSION}}'...""
    screen -S ""${{SESSION}}"" -X stuff ""{stopCmd}$(printf '\r')""
    sleep 4
    if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
        echo ""Warte auf sauberes Herunterfahren...""
        sleep 5
    fi
    echo ""Server beendet.""
else
    echo ""Server '${{SESSION}}' laeuft derzeit nicht.""
fi
";
    }

    private string SanitizeServerName(string name, string fallback)
    {
        if (string.IsNullOrWhiteSpace(name)) return fallback;
        var clean = new string(name.ToLowerInvariant().Where(c => char.IsLetterOrDigit(c) || c == '_' || c == '-').ToArray());
        return string.IsNullOrWhiteSpace(clean) ? fallback : clean;
    }

    private static string WrapPrivilegedCommand(ClusterNode node, string command)
    {
        if (string.Equals(node.SshUsername, "root", StringComparison.OrdinalIgnoreCase))
        {
            return command;
        }

        if (!string.IsNullOrEmpty(node.SshPassword))
        {
            var escapedPw = node.SshPassword.Replace("'", "'\\''");
            return $"echo '{escapedPw}' | sudo -S -p '' bash -c \"{command.Replace("\"", "\\\"")}\"";
        }

        return $"sudo bash -c \"{command.Replace("\"", "\\\"")}\"";
    }
}
