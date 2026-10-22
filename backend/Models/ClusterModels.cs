namespace McWaterfall.Backend.Models;

public enum ServerRole
{
    WaterfallProxy,
    Lobby,
    Overworld,
    Nether,
    End,
    Custom
}

public enum ServerType
{
    Waterfall,
    Paper,
    Purpur,
    Velocity
}

public enum NodeStatus
{
    Offline,
    Online,
    Starting,
    Stopping,
    Deploying,
    Error,
    Unknown
}

public class ClusterNode
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string Name { get; set; } = string.Empty;
    public ServerRole Role { get; set; } = ServerRole.Overworld;
    public ServerType ServerType { get; set; } = ServerType.Paper;
    
    // SSH connection info
    public string Host { get; set; } = "127.0.0.1";
    public int SshPort { get; set; } = 22;
    public string SshUsername { get; set; } = "root";
    public string? SshPassword { get; set; }
    public string? SshPrivateKey { get; set; }
    
    // Minecraft instance specs
    public int MinecraftPort { get; set; } = 25565;
    public int MemoryAllocationMb { get; set; } = 4096;
    public string RemoteDirectory { get; set; } = "/opt/minecraft/server";
    public string MinecraftVersion { get; set; } = "1.21.1";
    public string Motd { get; set; } = "A Minecraft Server";
    
    // Live / Cached state
    public NodeStatus Status { get; set; } = NodeStatus.Unknown;
    public int OnlinePlayers { get; set; } = 0;
    public int MaxPlayers { get; set; } = 100;
    public double CpuPercent { get; set; } = 0;
    public long RamUsedMb { get; set; } = 0;
    public string? LastError { get; set; }
    public DateTime? LastChecked { get; set; }
}

public class ClusterConfig
{
    public string ClusterName { get; set; } = "Dimensional Waterfall Cluster";
    public string BungeeSecret { get; set; } = Guid.NewGuid().ToString("N");
    public int ProxyPublicPort { get; set; } = 25565;
    public string DefaultServerRole { get; set; } = "Lobby";
    public List<ClusterNode> Nodes { get; set; } = new();
}

public class SshTestResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? OsInfo { get; set; }
    public bool JavaInstalled { get; set; }
    public string? JavaVersion { get; set; }
    public long MemoryTotalMb { get; set; }
    public long MemoryFreeMb { get; set; }
    public long DiskFreeGb { get; set; }
    public bool ScreenOrTmuxInstalled { get; set; }
}

public class DeploymentLog
{
    public string NodeId { get; set; } = string.Empty;
    public string Step { get; set; } = string.Empty;
    public bool Success { get; set; }
    public string Output { get; set; } = string.Empty;
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public class DeploymentRequest
{
    public List<string>? NodeIds { get; set; }
    public bool InstallJavaIfMissing { get; set; } = true;
    public bool ForceOverwriteConfig { get; set; } = false;
}

public class ConsoleCommandRequest
{
    public string NodeId { get; set; } = string.Empty;
    public string Command { get; set; } = string.Empty;
}

public class NodeLiveMetrics
{
    public string NodeId { get; set; } = string.Empty;
    public NodeStatus Status { get; set; }
    public bool IsProcessRunning { get; set; }
    public int Pid { get; set; }
    public double CpuPercent { get; set; }
    public long MemoryUsedMb { get; set; }
    public int OnlinePlayers { get; set; }
    public string? RawOutput { get; set; }
}
