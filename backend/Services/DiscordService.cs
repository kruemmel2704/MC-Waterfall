using System.Collections.Concurrent;
using System.Net.Http.Headers;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class DiscordService : IDiscordService
{
    private readonly HttpClient _httpClient;
    private readonly IClusterManagerService _clusterService;
    private readonly ILogger<DiscordService> _logger;
    private readonly string _configFilePath;
    private readonly string _linksFilePath;
    private readonly SemaphoreSlim _lock = new(1, 1);
    
    private DiscordConfig? _cachedConfig;
    private List<MinecraftDiscordLink>? _cachedLinks;
    private readonly ConcurrentDictionary<string, MinecraftOAuthSession> _activeSessions = new();

    private ClientWebSocket? _gatewayWs;
    private CancellationTokenSource? _gatewayCts;
    private string? _currentConnectedToken;

    public DiscordService(
        HttpClient httpClient, 
        IClusterManagerService clusterService,
        IWebHostEnvironment env, 
        ILogger<DiscordService> logger)
    {
        _httpClient = httpClient;
        _clusterService = clusterService;
        _logger = logger;

        var dataDir = Path.Combine(env.ContentRootPath, "Data");
        Directory.CreateDirectory(dataDir);
        _configFilePath = Path.Combine(dataDir, "discord_config.json");
        _linksFilePath = Path.Combine(dataDir, "minecraft_discord_links.json");
    }

    public async Task<DiscordConfig> GetConfigAsync()
    {
        if (_cachedConfig != null)
        {
            if (!string.IsNullOrWhiteSpace(_cachedConfig.BotToken))
            {
                EnsureGatewayConnected(_cachedConfig.BotToken);
            }
            return _cachedConfig;
        }

        await _lock.WaitAsync();
        try
        {
            if (File.Exists(_configFilePath))
            {
                var json = await File.ReadAllTextAsync(_configFilePath);
                _cachedConfig = JsonSerializer.Deserialize<DiscordConfig>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new DiscordConfig();
            }
            else
            {
                _cachedConfig = new DiscordConfig();
                await SaveConfigInternalAsync(_cachedConfig);
            }

            if (!string.IsNullOrWhiteSpace(_cachedConfig.BotToken))
            {
                EnsureGatewayConnected(_cachedConfig.BotToken);
            }

            return _cachedConfig;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task SaveConfigAsync(DiscordConfig config)
    {
        await _lock.WaitAsync();
        try
        {
            _cachedConfig = config;
            await SaveConfigInternalAsync(config);
            if (!string.IsNullOrWhiteSpace(config.BotToken))
            {
                EnsureGatewayConnected(config.BotToken);
            }
        }
        finally
        {
            _lock.Release();
        }
    }

    private void EnsureGatewayConnected(string? botToken)
    {
        var cleanToken = SanitizeAscii(botToken);
        if (string.IsNullOrWhiteSpace(cleanToken) || cleanToken.Contains('•') || cleanToken.Contains('*'))
        {
            return;
        }

        if (_currentConnectedToken == cleanToken && _gatewayWs != null && _gatewayWs.State == WebSocketState.Open)
        {
            return;
        }

        _currentConnectedToken = cleanToken;
        _gatewayCts?.Cancel();
        _gatewayCts = new CancellationTokenSource();
        var token = _gatewayCts.Token;

        _ = Task.Run(async () =>
        {
            while (!token.IsCancellationRequested)
            {
                try
                {
                    using var ws = new ClientWebSocket();
                    _gatewayWs = ws;
                    await ws.ConnectAsync(new Uri("wss://gateway.discord.gg/?v=10&encoding=json"), token);
                    _logger.LogInformation("Connected to Discord Gateway WebSocket.");

                    var buffer = new byte[16384];
                    var segment = new ArraySegment<byte>(buffer);

                    // 1. Receive Hello (opcode 10) to obtain heartbeat_interval
                    var result = await ws.ReceiveAsync(segment, token);
                    if (result.MessageType == WebSocketMessageType.Close) break;

                    var helloJson = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    using var helloDoc = JsonDocument.Parse(helloJson);
                    var heartbeatInterval = helloDoc.RootElement.GetProperty("d").GetProperty("heartbeat_interval").GetInt32();

                    // 2. Start Heartbeat Timer Loop
                    using var heartbeatCts = CancellationTokenSource.CreateLinkedTokenSource(token);
                    _ = Task.Run(async () =>
                    {
                        var hbToken = heartbeatCts.Token;
                        while (!hbToken.IsCancellationRequested && ws.State == WebSocketState.Open)
                        {
                            try
                            {
                                await Task.Delay(heartbeatInterval, hbToken);
                                var hbPayload = Encoding.UTF8.GetBytes("{\"op\":1,\"d\":null}");
                                await ws.SendAsync(new ArraySegment<byte>(hbPayload), WebSocketMessageType.Text, true, hbToken);
                            }
                            catch { break; }
                        }
                    }, heartbeatCts.Token);

                    // 3. Send Identify (opcode 2) - Presence: Online, Playing on Waterfall Cluster
                    var identifyPayload = $@"{{
                        ""op"": 2,
                        ""d"": {{
                            ""token"": ""{cleanToken}"",
                            ""intents"": 513,
                            ""properties"": {{
                                ""os"": ""linux"",
                                ""browser"": ""McWaterfall"",
                                ""device"": ""McWaterfall""
                            }},
                            ""presence"": {{
                                ""status"": ""online"",
                                ""activities"": [{{
                                    ""name"": ""Minecraft Waterfall Cluster"",
                                    ""type"": 0
                                }}],
                                ""afk"": false
                            }}
                        }}
                    }}";

                    var identifyBytes = Encoding.UTF8.GetBytes(identifyPayload);
                    await ws.SendAsync(new ArraySegment<byte>(identifyBytes), WebSocketMessageType.Text, true, token);
                    _logger.LogInformation("Discord Bot WaterfallMC is now ONLINE on Discord!");

                    // 4. Keep reading incoming frames
                    while (ws.State == WebSocketState.Open && !token.IsCancellationRequested)
                    {
                        var res = await ws.ReceiveAsync(segment, token);
                        if (res.MessageType == WebSocketMessageType.Close) break;
                    }

                    heartbeatCts.Cancel();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning("Discord Gateway connection event: {Message}, reconnecting in 15s...", ex.Message);
                }

                if (!token.IsCancellationRequested)
                {
                    await Task.Delay(15000, token).ContinueWith(_ => { });
                }
            }
        }, token);
    }

    private async Task SaveConfigInternalAsync(DiscordConfig config)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(config, options);
        await File.WriteAllTextAsync(_configFilePath, json);
    }

    public static string SanitizeAscii(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;
        var clean = input.Where(c => c >= 0x21 && c <= 0x7E).ToArray();
        return new string(clean);
    }

    public async Task<DiscordGuildInfo> VerifyGuildAsync(string? guildId = null, string? botToken = null)
    {
        var config = await GetConfigAsync();
        var targetGuildId = SanitizeAscii(string.IsNullOrWhiteSpace(guildId) ? config.GuildId : guildId);
        
        // Determine token: ignore masked bullets or stars, fallback to config.BotToken
        string candidateToken;
        if (!string.IsNullOrWhiteSpace(botToken) && !botToken.Contains('•') && !botToken.Contains('*'))
        {
            candidateToken = botToken;
        }
        else
        {
            candidateToken = config.BotToken;
        }

        var targetToken = SanitizeAscii(candidateToken);

        var result = new DiscordGuildInfo { Id = targetGuildId ?? string.Empty };

        if (string.IsNullOrWhiteSpace(targetGuildId))
        {
            result.ErrorMessage = "Bitte Discord Server-ID (Guild ID) eingeben.";
            return result;
        }

        if (string.IsNullOrWhiteSpace(targetToken))
        {
            result.ErrorMessage = "Kein Bot-Token hinterlegt. Bitte trage deinen Bot-Token im Feld 'BOT TOKEN' ein und klicke auf 'KONFIGURATION SPEICHERN'.";
            return result;
        }

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/v10/guilds/{targetGuildId}?with_counts=true");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bot", targetToken);

            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                result.IsBotPresent = false;
                result.ErrorMessage = $"Discord API antwortete mit Status {(int)res.StatusCode}: Ist der Bot auf diesem Server hinzugefügt?";
                return result;
            }

            var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
            result.IsBotPresent = true;
            result.Name = doc.TryGetProperty("name", out var n) ? n.GetString() ?? "Discord Server" : "Discord Server";
            
            if (doc.TryGetProperty("icon", out var iconProp) && iconProp.ValueKind == JsonValueKind.String)
            {
                var iconHash = iconProp.GetString();
                result.IconUrl = $"https://cdn.discordapp.com/icons/{targetGuildId}/{iconHash}.png";
            }

            if (doc.TryGetProperty("approximate_member_count", out var memProp))
            {
                result.ApproxMemberCount = memProp.GetInt32();
            }

            // Fetch guild roles
            if (doc.TryGetProperty("roles", out var rolesArr) && rolesArr.ValueKind == JsonValueKind.Array)
            {
                foreach (var r in rolesArr.EnumerateArray())
                {
                    result.Roles.Add(new DiscordRoleInfo
                    {
                        Id = r.GetProperty("id").GetString() ?? "",
                        Name = r.GetProperty("name").GetString() ?? "",
                        Color = r.TryGetProperty("color", out var c) ? c.GetInt32() : 0
                    });
                }
            }

            // Cache in config
            config.CachedGuildName = result.Name;
            config.CachedGuildIcon = result.IconUrl;
            config.IsGuildVerified = true;
            config.LastVerifiedAt = DateTime.UtcNow;
            await SaveConfigAsync(config);

            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to verify Discord Guild {GuildId}", targetGuildId);
            result.ErrorMessage = "Verbindungsfehler zur Discord API: " + ex.Message;
            return result;
        }
    }

    public string GetBotInviteUrl(string clientId)
    {
        var id = string.IsNullOrWhiteSpace(clientId) ? "YOUR_CLIENT_ID" : clientId.Trim();
        // Bot with Administrator (8) or Manage Roles & Read Messages
        return $"https://discord.com/oauth2/authorize?client_id={id}&scope=bot%20applications.commands&permissions=8";
    }

    public string GetOAuthAuthorizeUrl(string clientId, string redirectUri, string? state = null)
    {
        var id = string.IsNullOrWhiteSpace(clientId) ? "" : clientId.Trim();
        var encRedirect = Uri.EscapeDataString(redirectUri);
        var encState = string.IsNullOrWhiteSpace(state) ? "" : $"&state={Uri.EscapeDataString(state)}";
        return $"https://discord.com/oauth2/authorize?client_id={id}&response_type=code&scope=identify%20guilds&redirect_uri={encRedirect}{encState}";
    }

    public async Task<DiscordUserProfile> HandleOAuthCallbackAsync(string code, string redirectUri, string? state = null)
    {
        var config = await GetConfigAsync();
        var profile = new DiscordUserProfile();

        // 1. Exchange OAuth code for Access Token
        var tokenReq = new HttpRequestMessage(HttpMethod.Post, "https://discord.com/api/oauth2/token");
        tokenReq.Content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["client_id"] = config.ClientId,
            ["client_secret"] = config.ClientSecret,
            ["grant_type"] = "authorization_code",
            ["code"] = code,
            ["redirect_uri"] = redirectUri
        });

        var tokenRes = await _httpClient.SendAsync(tokenReq);
        if (!tokenRes.IsSuccessStatusCode)
        {
            var err = await tokenRes.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Discord Token-Austausch fehlgeschlagen: {err}");
        }

        var tokenJson = await tokenRes.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = tokenJson.GetProperty("access_token").GetString()!;

        // 2. Fetch User Profile
        using var userReq = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/users/@me");
        userReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var userRes = await _httpClient.SendAsync(userReq);
        if (!userRes.IsSuccessStatusCode)
        {
            throw new InvalidOperationException("Konnte Discord-Benutzerprofil nicht abrufen.");
        }

        var userDoc = await userRes.Content.ReadFromJsonAsync<JsonElement>();
        profile.Id = userDoc.GetProperty("id").GetString()!;
        profile.Username = userDoc.GetProperty("username").GetString()!;
        if (userDoc.TryGetProperty("global_name", out var gn) && gn.ValueKind == JsonValueKind.String)
        {
            profile.GlobalName = gn.GetString();
        }
        if (userDoc.TryGetProperty("avatar", out var av) && av.ValueKind == JsonValueKind.String)
        {
            profile.AvatarUrl = $"https://cdn.discordapp.com/avatars/{profile.Id}/{av.GetString()}.png";
        }

        // 3. Verify Guild Membership if GuildId is configured
        if (!string.IsNullOrWhiteSpace(config.GuildId))
        {
            using var guildsReq = new HttpRequestMessage(HttpMethod.Get, "https://discord.com/api/users/@me/guilds");
            guildsReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            var guildsRes = await _httpClient.SendAsync(guildsReq);

            if (guildsRes.IsSuccessStatusCode)
            {
                var guildsDoc = await guildsRes.Content.ReadFromJsonAsync<JsonElement>();
                var inGuild = guildsDoc.EnumerateArray().Any(g => g.GetProperty("id").GetString() == config.GuildId);
                profile.IsInConnectedGuild = inGuild;
            }

            // Check specific roles via bot if bot token is present
            var cleanBotToken = SanitizeAscii(config.BotToken);
            if (!string.IsNullOrWhiteSpace(cleanBotToken))
            {
                try
                {
                    using var memberReq = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/v10/guilds/{config.GuildId}/members/{profile.Id}");
                    memberReq.Headers.Authorization = new AuthenticationHeaderValue("Bot", cleanBotToken);
                    var memberRes = await _httpClient.SendAsync(memberReq);
                    if (memberRes.IsSuccessStatusCode)
                    {
                        var memberDoc = await memberRes.Content.ReadFromJsonAsync<JsonElement>();
                        if (memberDoc.TryGetProperty("roles", out var rolesProp))
                        {
                            profile.GuildRoles = rolesProp.EnumerateArray().Select(r => r.GetString()!).ToList();
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Could not fetch member roles from bot for user {UserId}", profile.Id);
                }
            }

            if (!string.IsNullOrWhiteSpace(config.AdminRoleId))
            {
                profile.IsAdmin = profile.GuildRoles.Contains(config.AdminRoleId);
            }
            else
            {
                profile.IsAdmin = profile.IsInConnectedGuild;
            }
        }
        else
        {
            profile.IsInConnectedGuild = true;
            profile.IsAdmin = true;
        }

        profile.SessionToken = Guid.NewGuid().ToString("N");

        // 4. Handle Minecraft Player In-Game Linking if state is present
        if (!string.IsNullOrWhiteSpace(state))
        {
            var targetPlayer = state.Trim();
            // If state is a session ID
            if (_activeSessions.TryGetValue(state, out var session))
            {
                targetPlayer = session.MinecraftUsername;
            }

            if (!string.IsNullOrWhiteSpace(targetPlayer))
            {
                var link = await LinkPlayerAsync(targetPlayer, profile.Id, profile.GlobalName ?? profile.Username, profile.AvatarUrl);
                if (session != null)
                {
                    session.IsCompleted = true;
                    session.CompletedLink = link;
                }
            }
        }

        return profile;
    }

    public async Task<List<MinecraftDiscordLink>> GetLinkedPlayersAsync()
    {
        if (_cachedLinks != null) return _cachedLinks;

        await _lock.WaitAsync();
        try
        {
            if (File.Exists(_linksFilePath))
            {
                var json = await File.ReadAllTextAsync(_linksFilePath);
                _cachedLinks = JsonSerializer.Deserialize<List<MinecraftDiscordLink>>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new List<MinecraftDiscordLink>();
            }
            else
            {
                _cachedLinks = new List<MinecraftDiscordLink>();
                await SaveLinksInternalAsync(_cachedLinks);
            }
            return _cachedLinks;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<MinecraftDiscordLink> LinkPlayerAsync(string minecraftUsername, string discordId, string discordTag, string? avatar = null)
    {
        var links = await GetLinkedPlayersAsync();
        var existing = links.FirstOrDefault(l => l.MinecraftUsername.Equals(minecraftUsername, StringComparison.OrdinalIgnoreCase));

        if (existing != null)
        {
            existing.DiscordId = discordId;
            existing.DiscordTag = discordTag;
            existing.DiscordAvatar = avatar ?? existing.DiscordAvatar;
            existing.LinkedAt = DateTime.UtcNow;
            existing.IsWhitelisted = true;
        }
        else
        {
            existing = new MinecraftDiscordLink
            {
                MinecraftUsername = minecraftUsername,
                DiscordId = discordId,
                DiscordTag = discordTag,
                DiscordAvatar = avatar,
                LinkedAt = DateTime.UtcNow,
                IsWhitelisted = true
            };
            links.Add(existing);
        }

        await _lock.WaitAsync();
        try
        {
            await SaveLinksInternalAsync(links);
        }
        finally
        {
            _lock.Release();
        }

        // Execute Whitelist on Cluster Nodes via SSH
        try
        {
            var clusterConfig = await _clusterService.GetConfigAsync();
            foreach (var node in clusterConfig.Nodes)
            {
                if (node.Role == ServerRole.WaterfallProxy)
                {
                    await _clusterService.SendCommandAsync(node.Id, $"alert &a[Discord Auth] Spieler {minecraftUsername} hat sich verifiziert!");
                }
                else
                {
                    await _clusterService.SendCommandAsync(node.Id, $"whitelist add {minecraftUsername}");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to run whitelist add command for {Player}", minecraftUsername);
        }

        // Automatic Role Sync if enabled
        var discordConf = await GetConfigAsync();
        if (discordConf.EnableRoleSync && discordConf.RoleMappings?.Count > 0)
        {
            _ = Task.Run(async () =>
            {
                try { await SyncPlayerRolesAsync(minecraftUsername); }
                catch (Exception ex) { _logger.LogWarning(ex, "Background role sync failed for {Player}", minecraftUsername); }
            });
        }

        return existing;
    }

    public async Task<bool> UnlinkPlayerAsync(string minecraftUsername)
    {
        var links = await GetLinkedPlayersAsync();
        var existing = links.FirstOrDefault(l => l.MinecraftUsername.Equals(minecraftUsername, StringComparison.OrdinalIgnoreCase));
        if (existing == null) return false;

        links.Remove(existing);

        await _lock.WaitAsync();
        try
        {
            await SaveLinksInternalAsync(links);
        }
        finally
        {
            _lock.Release();
        }

        // Remove from whitelist on nodes
        try
        {
            var clusterConfig = await _clusterService.GetConfigAsync();
            foreach (var node in clusterConfig.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy))
            {
                await _clusterService.SendCommandAsync(node.Id, $"whitelist remove {minecraftUsername}");
                await _clusterService.SendCommandAsync(node.Id, $"kick {minecraftUsername} §cDeine Discord-Verknüpfung wurde aufgehoben!");
            }
        }
        catch {}

        return true;
    }

    public async Task<bool> IsPlayerAuthorizedAsync(string minecraftUsername)
    {
        var links = await GetLinkedPlayersAsync();
        var link = links.FirstOrDefault(l => l.MinecraftUsername.Equals(minecraftUsername, StringComparison.OrdinalIgnoreCase) && l.IsWhitelisted);
        if (link == null) return false;

        var config = await GetConfigAsync();
        if (!config.EnableRoleSync || config.RoleMappings == null || config.RoleMappings.Count == 0)
        {
            return true;
        }

        var userRoles = await GetMemberRolesAsync(link.DiscordId);
        var mappings = config.RoleMappings.Where(m => m.AutoSync).OrderByDescending(m => m.Priority).ToList();
        var matched = mappings.FirstOrDefault(m => userRoles.Contains(m.DiscordRoleId));
        if (matched != null)
        {
            return matched.AllowMinecraftJoin;
        }

        return true;
    }

    public Task<MinecraftOAuthSession> CreateOAuthSessionAsync(string minecraftUsername)
    {
        var session = new MinecraftOAuthSession
        {
            MinecraftUsername = minecraftUsername,
            CreatedAt = DateTime.UtcNow
        };
        _activeSessions[session.SessionId] = session;
        return Task.FromResult(session);
    }

    public Task<MinecraftOAuthSession?> GetOAuthSessionAsync(string sessionId)
    {
        _activeSessions.TryGetValue(sessionId, out var session);
        return Task.FromResult(session);
    }

    public async Task<List<DiscordRoleMapping>> GetRoleMappingsAsync()
    {
        var config = await GetConfigAsync();
        return config.RoleMappings ?? new List<DiscordRoleMapping>();
    }

    public async Task SaveRoleMappingsAsync(List<DiscordRoleMapping> mappings)
    {
        var config = await GetConfigAsync();
        config.RoleMappings = mappings;
        await SaveConfigAsync(config);
    }

    public async Task<List<string>> GetMemberRolesAsync(string discordUserId)
    {
        var config = await GetConfigAsync();
        var cleanToken = SanitizeAscii(config.BotToken);
        if (string.IsNullOrWhiteSpace(config.GuildId) || string.IsNullOrWhiteSpace(cleanToken) || string.IsNullOrWhiteSpace(discordUserId))
        {
            return new List<string>();
        }

        try
        {
            using var req = new HttpRequestMessage(HttpMethod.Get, $"https://discord.com/api/v10/guilds/{config.GuildId}/members/{discordUserId}");
            req.Headers.Authorization = new AuthenticationHeaderValue("Bot", cleanToken);
            var res = await _httpClient.SendAsync(req);
            if (res.IsSuccessStatusCode)
            {
                var doc = await res.Content.ReadFromJsonAsync<JsonElement>();
                if (doc.TryGetProperty("roles", out var rProp) && rProp.ValueKind == JsonValueKind.Array)
                {
                    return rProp.EnumerateArray()
                        .Select(r => r.GetString())
                        .Where(r => !string.IsNullOrEmpty(r))
                        .Select(r => r!)
                        .ToList();
                }
            }
            else
            {
                _logger.LogWarning("Discord Member API returned status {StatusCode} for member {UserId}", res.StatusCode, discordUserId);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to query Discord member roles for {UserId}", discordUserId);
        }

        return new List<string>();
    }

    public async Task<RoleSyncResult> SyncPlayerRolesAsync(string minecraftUsername)
    {
        var links = await GetLinkedPlayersAsync();
        var link = links.FirstOrDefault(l => l.MinecraftUsername.Equals(minecraftUsername, StringComparison.OrdinalIgnoreCase));
        if (link == null)
        {
            return new RoleSyncResult { Success = false, Message = $"Spieler '{minecraftUsername}' ist nicht mit Discord verknüpft." };
        }

        var config = await GetConfigAsync();
        if (string.IsNullOrWhiteSpace(config.GuildId) || string.IsNullOrWhiteSpace(config.BotToken))
        {
            return new RoleSyncResult { Success = false, Message = "Discord Bot-Token oder Server-ID (Guild ID) fehlt." };
        }

        var mappings = config.RoleMappings.Where(m => m.AutoSync).OrderByDescending(m => m.Priority).ToList();
        if (mappings.Count == 0)
        {
            return new RoleSyncResult { Success = true, Message = "Keine aktiven Rollen-Zuordnungen vorhanden.", PlayersSynced = 0 };
        }

        // Fetch user's Discord roles from Discord Guild Member API
        var userRoles = await GetMemberRolesAsync(link.DiscordId);
        var userRoleIds = userRoles.ToHashSet();

        // Find highest priority matching mapping
        var matchedMapping = mappings.FirstOrDefault(m => userRoleIds.Contains(m.DiscordRoleId));
        var assignedGroup = matchedMapping != null ? matchedMapping.MinecraftGroup : "default";

        var cluster = await _clusterService.GetConfigAsync();
        var details = new List<string>();

        // Commands to execute on server(s)
        var commands = new List<string>();

        // 1. Whitelist handling based on role mapping
        if (matchedMapping != null && !matchedMapping.AllowMinecraftJoin)
        {
            commands.Add($"whitelist remove {link.MinecraftUsername}");
            commands.Add($"kick {link.MinecraftUsername} §cDeine Discord-Rolle hat keine Server-Beitrittsberechtigung!");
        }
        else
        {
            commands.Add($"whitelist add {link.MinecraftUsername}");
        }

        // 2. Custom Command or OP / LuckPerms Group
        if (matchedMapping != null && !string.IsNullOrWhiteSpace(matchedMapping.CustomCommand))
        {
            commands.Add(matchedMapping.CustomCommand.Replace("{player}", link.MinecraftUsername).Replace("{group}", matchedMapping.MinecraftGroup));
        }
        else if (matchedMapping?.IsOperator == true || assignedGroup.Equals("op", StringComparison.OrdinalIgnoreCase) || assignedGroup.Equals("operator", StringComparison.OrdinalIgnoreCase))
        {
            commands.Add($"op {link.MinecraftUsername}");
            commands.Add($"lp user {link.MinecraftUsername} parent set admin");
        }
        else
        {
            // Standard LuckPerms rank assignment command
            commands.Add($"lp user {link.MinecraftUsername} parent set {assignedGroup}");
        }

        // 3. Prefix if defined
        if (matchedMapping != null && !string.IsNullOrWhiteSpace(matchedMapping.Prefix))
        {
            commands.Add($"lp group {assignedGroup} meta setprefix {matchedMapping.Priority} \"{matchedMapping.Prefix}\"");
        }

        // Send command to all online nodes (Proxy + Dimensions)
        foreach (var node in cluster.Nodes)
        {
            foreach (var cmd in commands)
            {
                // Proxy doesn't have native Minecraft 'op' command, only backend Paper nodes do
                if (cmd.StartsWith("op ", StringComparison.OrdinalIgnoreCase) && node.Role == ServerRole.WaterfallProxy)
                    continue;

                await _clusterService.SendCommandAsync(node.Id, cmd);
            }
        }

        var detailMsg = matchedMapping != null 
            ? $"{link.MinecraftUsername} -> Rang '{assignedGroup}' (Discord: {matchedMapping.DiscordRoleName})"
            : $"{link.MinecraftUsername} -> Rang 'default' (Keine passende Discord-Rolle)";
        details.Add(detailMsg);

        return new RoleSyncResult
        {
            Success = true,
            Message = $"Rollen für '{link.MinecraftUsername}' erfolgreich synchronisiert.",
            PlayersSynced = 1,
            Details = details
        };
    }

    public async Task<RoleSyncResult> SyncAllPlayersRolesAsync()
    {
        var links = await GetLinkedPlayersAsync();
        if (links.Count == 0)
        {
            return new RoleSyncResult { Success = true, Message = "Keine verknüpften Spieler vorhanden.", PlayersSynced = 0 };
        }

        var totalSynced = 0;
        var allDetails = new List<string>();

        foreach (var link in links)
        {
            var res = await SyncPlayerRolesAsync(link.MinecraftUsername);
            if (res.Success && res.PlayersSynced > 0)
            {
                totalSynced++;
                allDetails.AddRange(res.Details);
            }
        }

        var result = new RoleSyncResult
        {
            Success = true,
            Message = $"{totalSynced} von {links.Count} Spielern erfolgreich synchronisiert.",
            PlayersSynced = totalSynced,
            Details = allDetails
        };

        try
        {
            var config = await GetConfigAsync();
            config.LastRoleSyncAt = DateTime.UtcNow;
            config.LastRoleSyncMessage = result.Message;
            await SaveConfigAsync(config);
        }
        catch {}

        return result;
    }

    private async Task SaveLinksInternalAsync(List<MinecraftDiscordLink> links)
    {
        var options = new JsonSerializerOptions { WriteIndented = true };
        var json = JsonSerializer.Serialize(links, options);
        await File.WriteAllTextAsync(_linksFilePath, json);
    }
}
