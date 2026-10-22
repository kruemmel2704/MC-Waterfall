using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiscordController : ControllerBase
{
    private readonly IDiscordService _discordService;
    private readonly ILogger<DiscordController> _logger;

    public DiscordController(IDiscordService discordService, ILogger<DiscordController> logger)
    {
        _discordService = discordService;
        _logger = logger;
    }

    [HttpGet("config")]
    public async Task<ActionResult<DiscordConfig>> GetConfig()
    {
        var config = await _discordService.GetConfigAsync();
        // Mask secret for safety
        var safeConfig = new DiscordConfig
        {
            IsEnabled = config.IsEnabled,
            ClientId = config.ClientId,
            ClientSecret = string.IsNullOrEmpty(config.ClientSecret) ? "" : "••••••••••••",
            BotToken = string.IsNullOrEmpty(config.BotToken) ? "" : "••••••••••••",
            GuildId = config.GuildId,
            RequiredRoleId = config.RequiredRoleId,
            AdminRoleId = config.AdminRoleId,
            RedirectUri = config.RedirectUri,
            EnableMinecraftOAuth2 = config.EnableMinecraftOAuth2,
            EnableMinecraftWhitelisting = config.EnableMinecraftWhitelisting,
            RequireGuildMembership = config.RequireGuildMembership,
            UnverifiedKickMessage = config.UnverifiedKickMessage,
            CachedGuildName = config.CachedGuildName,
            CachedGuildIcon = config.CachedGuildIcon,
            IsGuildVerified = config.IsGuildVerified,
            LastVerifiedAt = config.LastVerifiedAt
        };
        return Ok(safeConfig);
    }

    [HttpPost("config")]
    public async Task<IActionResult> SaveConfig([FromBody] DiscordConfig newConfig)
    {
        var current = await _discordService.GetConfigAsync();

        // Preserve secrets if not updated
        if (!string.IsNullOrWhiteSpace(newConfig.ClientSecret) && !newConfig.ClientSecret.Contains('•'))
        {
            current.ClientSecret = newConfig.ClientSecret.Trim();
        }
        if (!string.IsNullOrWhiteSpace(newConfig.BotToken) && !newConfig.BotToken.Contains('•'))
        {
            current.BotToken = newConfig.BotToken.Trim();
        }

        current.IsEnabled = newConfig.IsEnabled;
        current.ClientId = newConfig.ClientId?.Trim() ?? string.Empty;
        current.GuildId = newConfig.GuildId?.Trim() ?? string.Empty;
        current.RequiredRoleId = newConfig.RequiredRoleId?.Trim() ?? string.Empty;
        current.AdminRoleId = newConfig.AdminRoleId?.Trim() ?? string.Empty;
        current.RedirectUri = string.IsNullOrWhiteSpace(newConfig.RedirectUri) ? "http://localhost:5173/auth/discord" : newConfig.RedirectUri.Trim();
        current.EnableMinecraftOAuth2 = newConfig.EnableMinecraftOAuth2;
        current.EnableMinecraftWhitelisting = newConfig.EnableMinecraftWhitelisting;
        current.RequireGuildMembership = newConfig.RequireGuildMembership;
        current.UnverifiedKickMessage = newConfig.UnverifiedKickMessage;

        await _discordService.SaveConfigAsync(current);
        return Ok(new { success = true });
    }

    [HttpGet("verify-guild")]
    public async Task<ActionResult<DiscordGuildInfo>> VerifyGuild([FromQuery] string? guildId, [FromQuery] string? botToken)
    {
        var result = await _discordService.VerifyGuildAsync(guildId, botToken);
        return Ok(result);
    }

    [HttpGet("bot-invite-url")]
    public async Task<ActionResult<string>> GetBotInviteUrl()
    {
        var config = await _discordService.GetConfigAsync();
        var url = _discordService.GetBotInviteUrl(config.ClientId);
        return Ok(new { inviteUrl = url });
    }

    [HttpGet("oauth/url")]
    public async Task<ActionResult<string>> GetOAuthUrl([FromQuery] string? state, [FromQuery] string? redirectUri)
    {
        var config = await _discordService.GetConfigAsync();
        var uri = string.IsNullOrWhiteSpace(redirectUri) ? config.RedirectUri : redirectUri;
        var url = _discordService.GetOAuthAuthorizeUrl(config.ClientId, uri, state);
        return Ok(new { url });
    }

    [HttpPost("oauth/callback")]
    public async Task<ActionResult<DiscordUserProfile>> HandleOAuthCallback([FromBody] DiscordOAuthCallbackRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            return BadRequest("OAuth2 Code fehlt.");
        }

        var config = await _discordService.GetConfigAsync();
        var uri = string.IsNullOrWhiteSpace(request.RedirectUri) ? config.RedirectUri : request.RedirectUri;

        try
        {
            var profile = await _discordService.HandleOAuthCallbackAsync(request.Code, uri, request.State);
            return Ok(profile);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "OAuth callback failed");
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("minecraft/links")]
    public async Task<ActionResult<List<MinecraftDiscordLink>>> GetLinkedPlayers()
    {
        var links = await _discordService.GetLinkedPlayersAsync();
        return Ok(links);
    }

    [HttpPost("minecraft/link")]
    public async Task<ActionResult<MinecraftDiscordLink>> ManualLink([FromBody] ManualLinkRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.MinecraftUsername) || string.IsNullOrWhiteSpace(request.DiscordId))
        {
            return BadRequest("Minecraft Username und Discord ID sind erforderlich.");
        }

        var link = await _discordService.LinkPlayerAsync(
            request.MinecraftUsername.Trim(), 
            request.DiscordId.Trim(), 
            request.DiscordTag.Trim()
        );
        return Ok(link);
    }

    [HttpDelete("minecraft/links/{username}")]
    public async Task<IActionResult> UnlinkPlayer(string username)
    {
        var success = await _discordService.UnlinkPlayerAsync(username);
        return success ? Ok() : NotFound();
    }

    [HttpGet("minecraft/check/{username}")]
    public async Task<IActionResult> CheckPlayerAuthorization(string username)
    {
        var isAuthorized = await _discordService.IsPlayerAuthorizedAsync(username);
        return Ok(new { username, isAuthorized });
    }

    [HttpPost("minecraft/create-session")]
    public async Task<ActionResult<MinecraftOAuthSession>> CreateOAuthSession([FromQuery] string username)
    {
        if (string.IsNullOrWhiteSpace(username)) return BadRequest("Username fehlt.");
        var session = await _discordService.CreateOAuthSessionAsync(username.Trim());
        return Ok(session);
    }

    [HttpGet("minecraft/session/{sessionId}")]
    public async Task<ActionResult<MinecraftOAuthSession>> GetOAuthSession(string sessionId)
    {
        var session = await _discordService.GetOAuthSessionAsync(sessionId);
        if (session == null) return NotFound();
        return Ok(session);
    }

    [HttpGet("plugin/waterfall-guide")]
    public async Task<IActionResult> GetWaterfallOAuthGuide()
    {
        var config = await _discordService.GetConfigAsync();
        var guide = new
        {
            title = "Waterfall Proxy Discord OAuth2 Ingame-Authentifizierung",
            description = "Wie Spieler sich beim Betreten des Waterfall-Clusters nahtlos über Discord OAuth2 verifizieren.",
            flow = new[]
            {
                "1. Spieler betritt den Server (z.B. meincraftserver.de:25565)",
                "2. Waterfall fängt den Login ab und prüft via REST-API (/api/discord/minecraft/check/{spieler})",
                "3. Falls unauthentifiziert: Spieler wird in der Lobby/Limbo gehalten und erhält einen klickbaren Chat-Link mit OAuth2",
                "4. Spieler autorisiert sich im Browser mit Discord -> Backend verifiziert Server-Zugehörigkeit (Guild ID) & Rollen",
                "5. Backend sendet Bestätigungs-Signal an Waterfall -> Spieler wird freigeschaltet und auf Overworld/Dimensions weitergeleitet!"
            },
            sampleChatFormat = $"§e[Discord Auth] §fKlicke hier: §b§n{config.RedirectUri}?player={{player}}"
        };
        return Ok(guide);
    }
}
