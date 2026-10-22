namespace McWaterfall.Backend.Models;

public class DiscordConfig
{
    public bool IsEnabled { get; set; } = false;
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string BotToken { get; set; } = string.Empty;
    public string GuildId { get; set; } = string.Empty;
    public string RequiredRoleId { get; set; } = string.Empty;
    public string AdminRoleId { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "http://localhost:5173/auth/discord";
    
    // Minecraft In-Game OAuth2 Settings
    public bool EnableMinecraftOAuth2 { get; set; } = true;
    public bool EnableMinecraftWhitelisting { get; set; } = true;
    public bool RequireGuildMembership { get; set; } = true;
    public string UnverifiedKickMessage { get; set; } = "§cBitte verifiziere dich zuerst über Discord OAuth2: §bhttp://localhost:5173/auth/discord";
    
    // Role Synchronization (Discord -> LuckPerms / Minecraft)
    public bool EnableRoleSync { get; set; } = true;
    public int AutoSyncIntervalMinutes { get; set; } = 5;
    public DateTime? LastRoleSyncAt { get; set; }
    public string? LastRoleSyncMessage { get; set; }
    public List<DiscordRoleMapping> RoleMappings { get; set; } = new();

    // Verified Guild Cache
    public string? CachedGuildName { get; set; }
    public string? CachedGuildIcon { get; set; }
    public bool IsGuildVerified { get; set; }
    public DateTime? LastVerifiedAt { get; set; }
}

public class DiscordRoleInfo
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public int Color { get; set; }
}

public class DiscordGuildInfo
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? IconUrl { get; set; }
    public int ApproxMemberCount { get; set; }
    public bool IsBotPresent { get; set; }
    public string? ErrorMessage { get; set; }
    public List<DiscordRoleInfo> Roles { get; set; } = new();
}

public class DiscordUserProfile
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string? GlobalName { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsInConnectedGuild { get; set; }
    public bool IsAdmin { get; set; }
    public List<string> GuildRoles { get; set; } = new();
    public string? SessionToken { get; set; }
}

public class MinecraftDiscordLink
{
    public string MinecraftUsername { get; set; } = string.Empty;
    public string? MinecraftUuid { get; set; }
    public string DiscordId { get; set; } = string.Empty;
    public string DiscordTag { get; set; } = string.Empty;
    public string? DiscordAvatar { get; set; }
    public DateTime LinkedAt { get; set; } = DateTime.UtcNow;
    public bool IsWhitelisted { get; set; } = true;
}

public class MinecraftOAuthSession
{
    public string SessionId { get; set; } = Guid.NewGuid().ToString("N")[..12];
    public string MinecraftUsername { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsCompleted { get; set; }
    public MinecraftDiscordLink? CompletedLink { get; set; }
}

public class DiscordOAuthCallbackRequest
{
    public string Code { get; set; } = string.Empty;
    public string? State { get; set; } // Can hold MinecraftUsername or SessionId
    public string? RedirectUri { get; set; }
}

public class ManualLinkRequest
{
    public string MinecraftUsername { get; set; } = string.Empty;
    public string DiscordId { get; set; } = string.Empty;
    public string DiscordTag { get; set; } = string.Empty;
}

public class WebPermissions
{
    public bool AllowDashboardLogin { get; set; } = false;
    public bool IsSuperAdmin { get; set; } = false;
    public bool CanControlCluster { get; set; } = false;
    public bool CanManageNodes { get; set; } = false;
    public bool CanAccessConsole { get; set; } = false;
    public bool CanManageWorlds { get; set; } = false;
    public bool CanManagePlugins { get; set; } = false;
    public bool CanManageDiscord { get; set; } = false;

    public static WebPermissions FullAdmin => new()
    {
        AllowDashboardLogin = true,
        IsSuperAdmin = true,
        CanControlCluster = true,
        CanManageNodes = true,
        CanAccessConsole = true,
        CanManageWorlds = true,
        CanManagePlugins = true,
        CanManageDiscord = true
    };
}

public class DiscordRoleMapping
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string DiscordRoleId { get; set; } = string.Empty;
    public string DiscordRoleName { get; set; } = string.Empty;
    public int DiscordRoleColor { get; set; }
    
    // Minecraft In-Game Permissions & Settings
    public string MinecraftGroup { get; set; } = "default"; // e.g. "admin", "moderator", "vip", "booster", "builder"
    public string? Prefix { get; set; } // e.g. "&b[VIP] ", "&c[Admin] "
    public int Priority { get; set; } = 10;
    public bool AutoSync { get; set; } = true;
    public string? CustomCommand { get; set; } // e.g. "op {player}" or "lp user {player} parent set {group}"
    public bool IsOperator { get; set; } = false; // Grants vanilla /op {player}
    public bool AllowMinecraftJoin { get; set; } = true; // Auto-whitelist

    // Web Dashboard Permissions
    public WebPermissions WebPermissions { get; set; } = new();
}

public class RoleSyncResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public int PlayersSynced { get; set; }
    public List<string> Details { get; set; } = new();
}

public class SyncPlayerRolesRequest
{
    public string? MinecraftUsername { get; set; } // null to sync all linked players
}
