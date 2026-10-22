using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DiscordController : ControllerBase
{
    private readonly IDiscordService _discordService;
    private readonly IClusterManagerService _clusterService;
    private readonly IPluginManagerService _pluginService;
    private readonly ISshService _sshService;
    private readonly ILogger<DiscordController> _logger;

    public DiscordController(
        IDiscordService discordService,
        IClusterManagerService clusterService,
        IPluginManagerService pluginService,
        ISshService sshService,
        ILogger<DiscordController> logger)
    {
        _discordService = discordService;
        _clusterService = clusterService;
        _pluginService = pluginService;
        _sshService = sshService;
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
        if (!string.IsNullOrWhiteSpace(newConfig.ClientSecret) && !newConfig.ClientSecret.Contains('•') && !newConfig.ClientSecret.Contains('*'))
        {
            current.ClientSecret = DiscordService.SanitizeAscii(newConfig.ClientSecret);
        }
        if (!string.IsNullOrWhiteSpace(newConfig.BotToken) && !newConfig.BotToken.Contains('•') && !newConfig.BotToken.Contains('*'))
        {
            current.BotToken = DiscordService.SanitizeAscii(newConfig.BotToken);
        }

        current.IsEnabled = newConfig.IsEnabled;
        current.ClientId = DiscordService.SanitizeAscii(newConfig.ClientId);
        current.GuildId = DiscordService.SanitizeAscii(newConfig.GuildId);
        current.RequiredRoleId = DiscordService.SanitizeAscii(newConfig.RequiredRoleId);
        current.AdminRoleId = DiscordService.SanitizeAscii(newConfig.AdminRoleId);
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
        if (!string.IsNullOrEmpty(botToken) && (botToken.Contains('•') || botToken.Contains('*')))
        {
            botToken = null;
        }
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

    [HttpGet("roles/mappings")]
    public async Task<ActionResult<List<DiscordRoleMapping>>> GetRoleMappings()
    {
        var mappings = await _discordService.GetRoleMappingsAsync();
        return Ok(mappings);
    }

    [HttpPost("roles/mappings")]
    public async Task<IActionResult> SaveRoleMappings([FromBody] List<DiscordRoleMapping> mappings)
    {
        await _discordService.SaveRoleMappingsAsync(mappings);
        return Ok(new { success = true, message = "Rollen-Zuordnungen erfolgreich gespeichert!" });
    }

    [HttpPost("roles/sync")]
    public async Task<ActionResult<RoleSyncResult>> SyncRoles([FromBody] SyncPlayerRolesRequest? request)
    {
        if (!string.IsNullOrWhiteSpace(request?.MinecraftUsername))
        {
            var res = await _discordService.SyncPlayerRolesAsync(request.MinecraftUsername.Trim());
            return Ok(res);
        }

        var allRes = await _discordService.SyncAllPlayersRolesAsync();
        return Ok(allRes);
    }

    [HttpGet("guild/roles")]
    public async Task<ActionResult<List<DiscordRoleInfo>>> GetGuildRoles()
    {
        var guildInfo = await _discordService.VerifyGuildAsync();
        return Ok(guildInfo.Roles);
    }

    [HttpPost("whitelist/enforce")]
    public async Task<IActionResult> EnforceWhitelist([FromQuery] bool enabled = true)
    {
        var cluster = await _clusterService.GetConfigAsync();
        var discord = await _discordService.GetConfigAsync();
        var verifiedPlayers = await _discordService.GetLinkedPlayersAsync();
        var whitelistedUsernames = verifiedPlayers
            .Where(p => p.IsWhitelisted && !string.IsNullOrWhiteSpace(p.MinecraftUsername))
            .Select(p => p.MinecraftUsername.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        var kickMsg = !string.IsNullOrWhiteSpace(discord.UnverifiedKickMessage)
            ? discord.UnverifiedKickMessage
            : $"§cBitte verifiziere dich zuerst über Discord OAuth2: §b{discord.RedirectUri}";
        var escapedKickMsg = kickMsg.Replace("\"", "'");

        var details = new List<string>();

        // 1. Enforce on each Minecraft backend node (Lobby, Overworld, Nether, End)
        foreach (var node in cluster.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy))
        {
            var nodeDir = node.RemoteDirectory.TrimEnd('/');

            // Persist white-list & enforce-whitelist into server.properties
            var propScript = enabled
                ? $"cd '{nodeDir}' 2>/dev/null && " +
                  $"sed -i 's/^white-list=.*/white-list=true/' server.properties 2>/dev/null || true; " +
                  $"grep -q '^white-list=' server.properties 2>/dev/null || echo 'white-list=true' >> server.properties; " +
                  $"sed -i 's/^enforce-whitelist=.*/enforce-whitelist=true/' server.properties 2>/dev/null || true; " +
                  $"grep -q '^enforce-whitelist=' server.properties 2>/dev/null || echo 'enforce-whitelist=true' >> server.properties"
                : $"cd '{nodeDir}' 2>/dev/null && " +
                  $"sed -i 's/^white-list=.*/white-list=false/' server.properties 2>/dev/null || true; " +
                  $"sed -i 's/^enforce-whitelist=.*/enforce-whitelist=false/' server.properties 2>/dev/null || true";
            
            await _sshService.ExecuteCommandAsync(node, propScript, 10);

            // Update spigot.yml kick message
            if (enabled)
            {
                var spigotScript = $"cd '{nodeDir}' 2>/dev/null && sed -i 's|whitelist:.*|whitelist: \"{escapedKickMsg}\"|' spigot.yml 2>/dev/null || true";
                await _sshService.ExecuteCommandAsync(node, spigotScript, 10);
            }

            // Send Paper console commands
            var cmd = enabled ? "whitelist on" : "whitelist off";
            await _clusterService.SendCommandAsync(node.Id, cmd);
            await _clusterService.SendCommandAsync(node.Id, "whitelist reload");

            // If enabled, actively kick any unverified players currently online in Minecraft!
            if (enabled)
            {
                if (whitelistedUsernames.Count == 0)
                {
                    // No one is verified -> kick all active players immediately
                    await _clusterService.SendCommandAsync(node.Id, $"kick @a {escapedKickMsg}");
                }
                else
                {
                    // Kick anyone whose name is NOT in the whitelisted list
                    var filter = string.Join(",", whitelistedUsernames.Select(u => $"name=!{u}"));
                    await _clusterService.SendCommandAsync(node.Id, $"kick @a[{filter}] {escapedKickMsg}");
                }
            }

            details.Add($"{node.Name}: Whitelist {(enabled ? "aktiviert & erzwungen (unverifizierte Spieler gekickt)" : "deaktiviert")}.");
        }

        // 2. Alert on Waterfall Proxy
        var proxy = cluster.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy);
        if (proxy != null && enabled)
        {
            await _clusterService.SendCommandAsync(proxy.Id, "alert §6[Security] §eDiscord OAuth2 Whitelist ist ab sofort aktiv!");
        }

        return Ok(new 
        { 
            success = true, 
            message = $"Whitelist erfolgreich auf allen Servern {(enabled ? "aktiviert & erzwungen" : "deaktiviert")}!", 
            verifiedCount = whitelistedUsernames.Count,
            details 
        });
    }

    [HttpPost("install-discordsrv")]
    public async Task<IActionResult> InstallDiscordSrv()
    {
        var cluster = await _clusterService.GetConfigAsync();
        var discord = await _discordService.GetConfigAsync();
        var details = new List<string>();

        var targetNodes = cluster.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        if (targetNodes.Count == 0)
        {
            return BadRequest(new { success = false, message = "Keine Minecraft-Server gefunden." });
        }

        // 1. Fetch latest DiscordSRV version from Modrinth
        var versions = await _pluginService.GetModrinthVersionsAsync("discordsrv", "paper");
        var latest = versions.FirstOrDefault();
        var primaryFile = latest?.Files.FirstOrDefault(f => f.Primary) ?? latest?.Files.FirstOrDefault();

        if (primaryFile == null || string.IsNullOrWhiteSpace(primaryFile.Url))
        {
            return BadRequest(new { success = false, message = "DiscordSRV konnte auf Modrinth nicht gefunden werden." });
        }

        foreach (var node in targetNodes)
        {
            try
            {
                var req = new InstallPluginRequest
                {
                    NodeId = node.Id,
                    DownloadUrl = primaryFile.Url,
                    FileName = primaryFile.Filename,
                    PluginName = "DiscordSRV"
                };

                var installRes = await _pluginService.InstallPluginAsync(req);
                if (installRes.Success)
                {
                    if (!string.IsNullOrWhiteSpace(discord.BotToken))
                    {
                        var configPath = $"{node.RemoteDirectory.TrimEnd('/')}/plugins/DiscordSRV/config.yml";
                        var updateTokenCmd = $"mkdir -p '{node.RemoteDirectory.TrimEnd('/')}/plugins/DiscordSRV' && if [ -f '{configPath}' ]; then sed -i 's/^BotToken:.*/BotToken: \"{discord.BotToken}\"/' '{configPath}'; fi";
                        await _sshService.ExecuteCommandAsync(node, updateTokenCmd, 10);
                    }
                    details.Add($"{node.Name}: DiscordSRV installiert & vorkonfiguriert.");
                }
                else
                {
                    details.Add($"{node.Name}: {installRes.Message}");
                }
            }
            catch (Exception ex)
            {
                details.Add($"{node.Name}: Fehler bei Installation: {ex.Message}");
            }
        }

        return Ok(new { success = true, message = "DiscordSRV-Bereitstellung abgeschlossen!", details });
    }
}
