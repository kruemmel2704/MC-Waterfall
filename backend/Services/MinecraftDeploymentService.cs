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

    private async Task<string> ResolveDownloadUrlAsync(ClusterNode node)
    {
        const string userAgent = "McWaterfall/1.0 (admin@example.com)";

        if (node.Role == ServerRole.WaterfallProxy || node.ServerType == ServerType.Waterfall)
        {
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, "https://fill.papermc.io/v3/projects/waterfall/versions/1.21");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("builds", out var builds) && builds.GetArrayLength() > 0)
                    {
                        var latestBuild = builds[0].GetInt32();
                        using var buildReq = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/waterfall/versions/1.21/builds/{latestBuild}");
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
                _logger.LogWarning(ex, "Failed to resolve latest Waterfall from Fill API, using verified direct fallback.");
            }
            // Verified active direct download URL
            return "https://fill-data.papermc.io/v1/objects/5eda8bfd0691e5088701f87020c68964299586df0faba289a634122d282d598c/waterfall-1.21-615.jar";
        }
        else
        {
            // PaperMC
            var mcVersion = string.IsNullOrWhiteSpace(node.MinecraftVersion) ? "1.21.1" : node.MinecraftVersion;
            try
            {
                using var req = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/paper/versions/{mcVersion}");
                req.Headers.Add("User-Agent", userAgent);
                var res = await _httpClient.SendAsync(req);
                if (res.IsSuccessStatusCode)
                {
                    var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                    if (doc.TryGetProperty("builds", out var builds) && builds.GetArrayLength() > 0)
                    {
                        var latestBuild = builds[0].GetInt32();
                        using var buildReq = new HttpRequestMessage(HttpMethod.Get, $"https://fill.papermc.io/v3/projects/paper/versions/{mcVersion}/builds/{latestBuild}");
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
                _logger.LogWarning(ex, "Failed to resolve Paper build for {Version}, using verified direct fallback.", mcVersion);
            }
            // Verified active direct download URL for Paper 1.21.1
            return "https://fill-data.papermc.io/v1/objects/39bd8c00b9e18de91dcabd3cc3dcfa5328685a53b7187a2f63280c22e2d287b9/paper-1.21.1-133.jar";
        }
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
        sb.AppendLine("white-list=false");
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

    public string GenerateSpigotConfig(ClusterNode node)
    {
        return @"# Spigot configuration for Waterfall Dimension Cluster
config-version: 12
settings:
  bungeecord: true
  save-user-cache-on-stop-only: false
  sample-count: 12
  player-shuffle: 0
  user-cache-size: 1000
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
";
    }

    public string GenerateRunScript(ClusterNode node)
    {
        var ram = node.MemoryAllocationMb > 0 ? node.MemoryAllocationMb : 4096;
        var sessionName = $"mc_{node.Id}";
        
        return $@"#!/usr/bin/env bash
# Start script for {node.Name} ({node.Role})
cd ""$(dirname ""$0"")""

SESSION=""{sessionName}""
screen -wipe 2>/dev/null

if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
    echo ""Server {node.Name} laeuft bereits in Screen-Session '${{SESSION}}'.""
    exit 0
fi

echo ""Starte {node.Name} mit {ram}MB RAM...""
screen -dmS ""${{SESSION}}"" java -Xms{ram}M -Xmx{ram}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -XX:+UnlockExperimentalVMOptions -XX:+DisableExplicitGC -XX:+AlwaysPreTouch -jar server.jar nogui

sleep 2
if screen -list | grep -q ""\.${{SESSION}}[[:space:]]""; then
    echo ""Server erfolgreich im Screen '${{SESSION}}' gestartet.""
else
    echo ""Warnung: Prozess konnte nicht sofort bestaetigt werden.""
fi
";
    }

    private string GenerateStopScript(ClusterNode node)
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
