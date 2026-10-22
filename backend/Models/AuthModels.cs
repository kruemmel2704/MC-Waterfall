namespace McWaterfall.Backend.Models;

public enum ServerArchitecture
{
    DimensionalCluster,
    SingleServer
}

public class SystemSettings
{
    public bool IsConfigured { get; set; } = false;
    public string ServerName { get; set; } = "Minecraft Waterfall Cluster";
    public ServerArchitecture Architecture { get; set; } = ServerArchitecture.DimensionalCluster;
    public string AdminUsername { get; set; } = "admin";
    public string AdminPasswordHash { get; set; } = string.Empty;
    public string AdminPasswordSalt { get; set; } = string.Empty;
    public bool DiscordOAuthEnabled { get; set; } = false;
    public DateTime? SetupCompletedAt { get; set; }
}

public class AuthStatusResponse
{
    public bool IsConfigured { get; set; }
    public bool IsAuthenticated { get; set; }
    public string? Username { get; set; }
    public string? AuthMethod { get; set; } // "local" | "discord"
    public string? AvatarUrl { get; set; }
    public bool DiscordOAuthEnabled { get; set; }
    public string ServerName { get; set; } = string.Empty;
    public ServerArchitecture Architecture { get; set; }
    public string? DiscordClientId { get; set; }
    public WebPermissions? Permissions { get; set; }
}

public class LoginRequest
{
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public class LoginResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? Token { get; set; }
    public string? Username { get; set; }
    public string? AuthMethod { get; set; }
    public string? AvatarUrl { get; set; }
    public WebPermissions? Permissions { get; set; }
}

public class SetupWizardRequest
{
    public string AdminUsername { get; set; } = "admin";
    public string AdminPassword { get; set; } = string.Empty;
    public string ServerName { get; set; } = "Mein Minecraft Server";
    public ServerArchitecture Architecture { get; set; } = ServerArchitecture.DimensionalCluster;
    
    // For Single Server mode
    public SingleServerSetup? SingleServer { get; set; }
    
    // For Cluster mode
    public ClusterSetup? Cluster { get; set; }
    
    // Optional Discord
    public bool EnableDiscord { get; set; }
    public string? DiscordClientId { get; set; }
    public string? DiscordClientSecret { get; set; }
    public string? DiscordGuildId { get; set; }
}

public class SingleServerSetup
{
    public string Host { get; set; } = "127.0.0.1";
    public int SshPort { get; set; } = 22;
    public string SshUsername { get; set; } = "root";
    public string? SshPassword { get; set; }
    public int MinecraftPort { get; set; } = 25565;
    public int MemoryMb { get; set; } = 6144;
    public string RemoteDirectory { get; set; } = "/opt/minecraft/server";
    public string MinecraftVersion { get; set; } = "1.21.1";
}

public class ClusterSetup
{
    public bool AllNodesOnSameHost { get; set; } = true;
    public string MasterHost { get; set; } = "127.0.0.1";
    public int MasterSshPort { get; set; } = 22;
    public string MasterSshUsername { get; set; } = "root";
    public string? MasterSshPassword { get; set; }
    public int ProxyPublicPort { get; set; } = 25565;
    public List<ClusterNode>? CustomNodes { get; set; }
}

public class UpdateSettingsRequest
{
    public string? ServerName { get; set; }
    public ServerArchitecture? Architecture { get; set; }
    public string? NewAdminUsername { get; set; }
    public string? CurrentPassword { get; set; }
    public string? NewPassword { get; set; }
    public bool? DiscordOAuthEnabled { get; set; }
}
