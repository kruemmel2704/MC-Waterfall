using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IDiscordService
{
    Task<DiscordConfig> GetConfigAsync();
    Task SaveConfigAsync(DiscordConfig config);
    Task<DiscordGuildInfo> VerifyGuildAsync(string? guildId = null, string? botToken = null);
    string GetBotInviteUrl(string clientId);
    string GetOAuthAuthorizeUrl(string clientId, string redirectUri, string? state = null);
    Task<DiscordUserProfile> HandleOAuthCallbackAsync(string code, string redirectUri, string? state = null);
    
    // Minecraft Player Linking & OAuth2
    Task<List<MinecraftDiscordLink>> GetLinkedPlayersAsync();
    Task<MinecraftDiscordLink> LinkPlayerAsync(string minecraftUsername, string discordId, string discordTag, string? avatar = null);
    Task<bool> UnlinkPlayerAsync(string minecraftUsername);
    Task<bool> IsPlayerAuthorizedAsync(string minecraftUsername);
    Task<MinecraftOAuthSession> CreateOAuthSessionAsync(string minecraftUsername);
    Task<MinecraftOAuthSession?> GetOAuthSessionAsync(string sessionId);

    // Role Synchronization (Discord -> LuckPerms / Minecraft)
    Task<List<DiscordRoleMapping>> GetRoleMappingsAsync();
    Task SaveRoleMappingsAsync(List<DiscordRoleMapping> mappings);
    Task<RoleSyncResult> SyncPlayerRolesAsync(string minecraftUsername);
    Task<RoleSyncResult> SyncAllPlayersRolesAsync();
}
