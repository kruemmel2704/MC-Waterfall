using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class ClusterManagerService : IClusterManagerService
{
    private readonly ISshService _sshService;
    private readonly IMinecraftDeploymentService _deploymentService;
    private readonly ILogger<ClusterManagerService> _logger;
    private readonly string _configFilePath;
    private readonly SemaphoreSlim _lock = new(1, 1);
    private ClusterConfig? _cachedConfig;

    public ClusterManagerService(
        ISshService sshService,
        IMinecraftDeploymentService deploymentService,
        IWebHostEnvironment env,
        ILogger<ClusterManagerService> logger)
    {
        _sshService = sshService;
        _deploymentService = deploymentService;
        _logger = logger;
        
        var dataDir = Path.Combine(env.ContentRootPath, "Data");
        Directory.CreateDirectory(dataDir);
        _configFilePath = Path.Combine(dataDir, "cluster_config.json");
    }

    public async Task<ClusterConfig> GetConfigAsync()
    {
        if (_cachedConfig != null) return _cachedConfig;

        await _lock.WaitAsync();
        try
        {
            if (File.Exists(_configFilePath))
            {
                var json = await File.ReadAllTextAsync(_configFilePath);
                _cachedConfig = JsonSerializer.Deserialize<ClusterConfig>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? CreateDefaultClusterConfig();
            }
            else
            {
                _cachedConfig = CreateDefaultClusterConfig();
                await SaveConfigInternalAsync(_cachedConfig);
            }

            return _cachedConfig;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SaveConfigAsync(ClusterConfig config)
    {
        await _lock.WaitAsync();
        try
        {
            _cachedConfig = config;
            await SaveConfigInternalAsync(config);
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task SaveConfigInternalAsync(ClusterConfig config)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(config, options);
        await File.WriteAllTextAsync(_configFilePath, json);
    }

    public async Task<ClusterNode?> GetNodeAsync(string nodeId)
    {
        var config = await GetConfigAsync();
        return config.Nodes.FirstOrDefault(n => n.Id == nodeId);
    }

    public async Task<ClusterNode> AddOrUpdateNodeAsync(ClusterNode node)
    {
        var config = await GetConfigAsync();
        var existing = config.Nodes.FirstOrDefault(n => n.Id == node.Id);

        if (existing != null)
        {
            var idx = config.Nodes.IndexOf(existing);
            config.Nodes[idx] = node;
        }
        else
        {
            if (string.IsNullOrWhiteSpace(node.Id))
            {
                node.Id = Guid.NewGuid().ToString("N")[..8];
            }
            config.Nodes.Add(node);
        }

        await SaveConfigAsync(config);
        return node;
    }

    public async Task<bool> DeleteNodeAsync(string nodeId)
    {
        var config = await GetConfigAsync();
        var existing = config.Nodes.FirstOrDefault(n => n.Id == nodeId);
        if (existing == null) return false;

        config.Nodes.Remove(existing);
        await SaveConfigAsync(config);
        return true;
    }

    public async Task<bool> StartNodeAsync(string nodeId)
    {
        var node = await GetNodeAsync(nodeId);
        if (node == null) return false;

        var cmd = $"cd '{node.RemoteDirectory.TrimEnd('/')}' && ./run.sh";
        var res = await _sshService.ExecuteCommandAsync(node, cmd, 20);
        await RefreshNodeStatusAsync(nodeId);
        return res.ExitCode == 0;
    }

    public async Task<bool> StopNodeAsync(string nodeId)
    {
        var node = await GetNodeAsync(nodeId);
        if (node == null) return false;

        var cmd = $"cd '{node.RemoteDirectory.TrimEnd('/')}' && ./stop.sh";
        var res = await _sshService.ExecuteCommandAsync(node, cmd, 25);
        await RefreshNodeStatusAsync(nodeId);
        return res.ExitCode == 0;
    }

    public async Task<bool> RestartNodeAsync(string nodeId)
    {
        var node = await GetNodeAsync(nodeId);
        if (node == null) return false;

        var cmd = $"cd '{node.RemoteDirectory.TrimEnd('/')}' && ./stop.sh && sleep 3 && ./run.sh";
        var res = await _sshService.ExecuteCommandAsync(node, cmd, 35);
        await RefreshNodeStatusAsync(nodeId);
        return res.ExitCode == 0;
    }

    public async Task<string> SendCommandAsync(string nodeId, string command)
    {
        var node = await GetNodeAsync(nodeId);
        if (node == null) return "Fehler: Knoten nicht gefunden.";

        var cleanCmd = command.Replace("\"", "\\\"").Replace("$", "\\$");
        var sessionName = $"mc_{node.Id}";
        var sshCmd = $"screen -S \"{sessionName}\" -X stuff \"{cleanCmd}$(printf '\\r')\"";

        var res = await _sshService.ExecuteCommandAsync(node, sshCmd, 10);
        if (res.ExitCode == 0)
        {
            return $"Befehl '{command}' an {node.Name} ({sessionName}) gesendet.";
        }
        return $"Fehler beim Senden: {res.StdErr}";
    }

    public async Task StartClusterAsync()
    {
        var config = await GetConfigAsync();

        // 1. Start all dimension backend servers
        var backendNodes = config.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        foreach (var node in backendNodes)
        {
            try
            {
                await StartNodeAsync(node.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to start node {NodeName}", node.Name);
            }
        }

        // Wait for backends to bind
        await Task.Delay(3000);

        // 2. Start Waterfall proxy
        var proxy = config.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy);
        if (proxy != null)
        {
            await StartNodeAsync(proxy.Id);
        }
    }

    public async Task StopClusterAsync()
    {
        var config = await GetConfigAsync();

        // 1. Stop Proxy first
        var proxy = config.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy);
        if (proxy != null)
        {
            try
            {
                await StopNodeAsync(proxy.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to stop proxy node");
            }
        }

        // 2. Stop all backends
        var backendNodes = config.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        foreach (var node in backendNodes)
        {
            try
            {
                await StopNodeAsync(node.Id);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to stop backend node {NodeName}", node.Name);
            }
        }
    }

    public async Task<bool> SyncWaterfallConfigAsync()
    {
        var config = await GetConfigAsync();
        var proxy = config.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy);
        if (proxy == null) return false;

        var configYml = _deploymentService.GenerateWaterfallConfig(config, proxy);
        var remotePath = $"{proxy.RemoteDirectory.TrimEnd('/')}/config.yml";
        await _sshService.UploadTextFileAsync(proxy, remotePath, configYml);

        // Send reload command to Waterfall
        await SendCommandAsync(proxy.Id, "greload");
        return true;
    }

    public async Task<NodeLiveMetrics> RefreshNodeStatusAsync(string nodeId)
    {
        var node = await GetNodeAsync(nodeId);
        var metrics = new NodeLiveMetrics { NodeId = nodeId };

        if (node == null)
        {
            metrics.Status = NodeStatus.Error;
            return metrics;
        }

        try
        {
            // Check screen session and Java PID
            var sessionName = $"mc_{node.Id}";
            var cmd = $"screen -list | grep '{sessionName}' && pgrep -f '{sessionName}' || true";
            var (exitCode, stdOut, stdErr) = await _sshService.ExecuteCommandAsync(node, cmd, 8);

            var isRunning = !string.IsNullOrWhiteSpace(stdOut) && stdOut.Contains(sessionName);
            metrics.IsProcessRunning = isRunning;
            metrics.Status = isRunning ? NodeStatus.Online : NodeStatus.Offline;

            if (isRunning)
            {
                // Try parse PID and resource usage
                var pidCmd = $"pgrep -f '{sessionName}' | head -n 1";
                var pidRes = await _sshService.ExecuteCommandAsync(node, pidCmd, 5);
                if (int.TryParse(pidRes.StdOut.Trim(), out var pid))
                {
                    metrics.Pid = pid;
                    var statCmd = $"ps -p {pid} -o %cpu,%mem,rss --no-headers 2>/dev/null";
                    var statRes = await _sshService.ExecuteCommandAsync(node, statCmd, 5);
                    var parts = statRes.StdOut.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length >= 3)
                    {
                        if (double.TryParse(parts[0], out var cpu)) metrics.CpuPercent = cpu;
                        if (long.TryParse(parts[2], out var rssKb)) metrics.MemoryUsedMb = rssKb / 1024;
                    }
                }
            }

            node.Status = metrics.Status;
            node.CpuPercent = metrics.CpuPercent;
            node.RamUsedMb = metrics.MemoryUsedMb;
            node.LastChecked = DateTime.UtcNow;

            return metrics;
        }
        catch (Exception ex)
        {
            metrics.Status = NodeStatus.Error;
            node.Status = NodeStatus.Error;
            node.LastError = ex.Message;
            return metrics;
        }
    }

    public async Task<List<NodeLiveMetrics>> RefreshAllStatusAsync()
    {
        var config = await GetConfigAsync();
        var tasks = config.Nodes.Select(n => RefreshNodeStatusAsync(n.Id)).ToList();
        var results = await Task.WhenAll(tasks);
        return results.ToList();
    }

    private ClusterConfig CreateDefaultClusterConfig()
    {
        return new ClusterConfig
        {
            ClusterName = "Dimension Waterfall Cluster",
            BungeeSecret = Guid.NewGuid().ToString("N")[..16],
            ProxyPublicPort = 25565,
            DefaultServerRole = "Lobby",
            Nodes = new List<ClusterNode>
            {
                new()
                {
                    Id = "proxy",
                    Name = "Waterfall Proxy",
                    Role = ServerRole.WaterfallProxy,
                    ServerType = ServerType.Waterfall,
                    Host = "127.0.0.1",
                    SshPort = 22,
                    SshUsername = "root",
                    MinecraftPort = 25565,
                    MemoryAllocationMb = 2048,
                    RemoteDirectory = "/opt/minecraft/waterfall",
                    MinecraftVersion = "1.20",
                    Motd = "&b&lWaterfall Proxy &8- &7Dimension Gateway",
                    Status = NodeStatus.Offline
                },
                new()
                {
                    Id = "lobby",
                    Name = "Hub / Lobby Server",
                    Role = ServerRole.Lobby,
                    ServerType = ServerType.Paper,
                    Host = "127.0.0.1",
                    SshPort = 22,
                    SshUsername = "root",
                    MinecraftPort = 25566,
                    MemoryAllocationMb = 3072,
                    RemoteDirectory = "/opt/minecraft/lobby",
                    MinecraftVersion = "1.21.1",
                    Motd = "&aHaupt-Lobby & Dimension Hub",
                    Status = NodeStatus.Offline
                },
                new()
                {
                    Id = "overworld",
                    Name = "Overworld Dimension",
                    Role = ServerRole.Overworld,
                    ServerType = ServerType.Paper,
                    Host = "127.0.0.1",
                    SshPort = 22,
                    SshUsername = "root",
                    MinecraftPort = 25567,
                    MemoryAllocationMb = 6144,
                    RemoteDirectory = "/opt/minecraft/overworld",
                    MinecraftVersion = "1.21.1",
                    Motd = "&2Overworld Survival Dimension",
                    Status = NodeStatus.Offline
                },
                new()
                {
                    Id = "nether",
                    Name = "Nether Dimension",
                    Role = ServerRole.Nether,
                    ServerType = ServerType.Paper,
                    Host = "127.0.0.1",
                    SshPort = 22,
                    SshUsername = "root",
                    MinecraftPort = 25568,
                    MemoryAllocationMb = 4096,
                    RemoteDirectory = "/opt/minecraft/nether",
                    MinecraftVersion = "1.21.1",
                    Motd = "&cNether Dimension &8- &4Hell",
                    Status = NodeStatus.Offline
                },
                new()
                {
                    Id = "the_end",
                    Name = "The End Dimension",
                    Role = ServerRole.End,
                    ServerType = ServerType.Paper,
                    Host = "127.0.0.1",
                    SshPort = 22,
                    SshUsername = "root",
                    MinecraftPort = 25569,
                    MemoryAllocationMb = 4096,
                    RemoteDirectory = "/opt/minecraft/the_end",
                    MinecraftVersion = "1.21.1",
                    Motd = "&5The End Dimension &8- &dVoid",
                    Status = NodeStatus.Offline
                }
            }
        };
    }
}
