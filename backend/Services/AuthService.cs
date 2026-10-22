using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class AuthSession
{
    public string Token { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string AuthMethod { get; set; } = "local"; // "local" | "discord"
    public string? AvatarUrl { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddDays(7);
}

public class AuthService : IAuthService
{
    private readonly IClusterManagerService _clusterService;
    private readonly IDiscordService _discordService;
    private readonly ILogger<AuthService> _logger;
    private readonly string _settingsFilePath;
    private readonly string _sessionsFilePath;
    private readonly SemaphoreSlim _lock = new(1, 1);

    private SystemSettings? _cachedSettings;
    private readonly ConcurrentDictionary<string, AuthSession> _sessions = new();

    public AuthService(
        IClusterManagerService clusterService,
        IDiscordService discordService,
        IWebHostEnvironment env,
        ILogger<AuthService> logger)
    {
        _clusterService = clusterService;
        _discordService = discordService;
        _logger = logger;

        var dataDir = Path.Combine(env.ContentRootPath, "Data");
        Directory.CreateDirectory(dataDir);
        _settingsFilePath = Path.Combine(dataDir, "system_settings.json");
        _sessionsFilePath = Path.Combine(dataDir, "active_sessions.json");

        LoadSessions();
    }

    public async Task<SystemSettings> GetSettingsAsync()
    {
        if (_cachedSettings != null) return _cachedSettings;

        await _lock.WaitAsync();
        try
        {
            if (File.Exists(_settingsFilePath))
            {
                var json = await File.ReadAllTextAsync(_settingsFilePath);
                _cachedSettings = JsonSerializer.Deserialize<SystemSettings>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                }) ?? new SystemSettings();
            }
            else
            {
                // Check if cluster was already in use
                var cluster = await _clusterService.GetConfigAsync();
                var hasCustomizedNodes = cluster.Nodes.Any(n => n.Host != "127.0.0.1" || !string.IsNullOrEmpty(n.SshPassword));
                
                _cachedSettings = new SystemSettings
                {
                    IsConfigured = hasCustomizedNodes,
                    ServerName = cluster.ClusterName ?? "Minecraft Cluster"
                };
                await SaveSettingsInternalAsync(_cachedSettings);
            }
            return _cachedSettings;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<AuthStatusResponse> GetStatusAsync(string? sessionToken)
    {
        var settings = await GetSettingsAsync();
        var discordConfig = await _discordService.GetConfigAsync();

        var isAuthenticated = false;
        string? username = null;
        string? authMethod = null;
        string? avatarUrl = null;

        if (!string.IsNullOrWhiteSpace(sessionToken) && _sessions.TryGetValue(sessionToken, out var session))
        {
            if (session.ExpiresAt > DateTime.UtcNow)
            {
                isAuthenticated = true;
                username = session.Username;
                authMethod = session.AuthMethod;
                avatarUrl = session.AvatarUrl;
            }
            else
            {
                _sessions.TryRemove(sessionToken, out _);
            }
        }

        return new AuthStatusResponse
        {
            IsConfigured = settings.IsConfigured,
            IsAuthenticated = isAuthenticated,
            Username = username,
            AuthMethod = authMethod,
            AvatarUrl = avatarUrl,
            DiscordOAuthEnabled = settings.DiscordOAuthEnabled || discordConfig.IsEnabled,
            ServerName = settings.ServerName,
            Architecture = settings.Architecture,
            DiscordClientId = discordConfig.ClientId
        };
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        var settings = await GetSettingsAsync();
        if (!settings.IsConfigured)
        {
            return new LoginResponse { Success = false, Message = "Das System ist noch nicht eingerichtet. Bitte /setup aufrufen." };
        }

        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return new LoginResponse { Success = false, Message = "Benutzername und Passwort dürfen nicht leer sein." };
        }

        var isUserValid = string.Equals(request.Username.Trim(), settings.AdminUsername, StringComparison.OrdinalIgnoreCase);
        var isPassValid = VerifyPassword(request.Password, settings.AdminPasswordHash, settings.AdminPasswordSalt);

        if (!isUserValid || !isPassValid)
        {
            return new LoginResponse { Success = false, Message = "Ungültige Anmeldedaten." };
        }

        var token = Guid.NewGuid().ToString("N");
        var session = new AuthSession
        {
            Token = token,
            Username = settings.AdminUsername,
            AuthMethod = "local",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };

        _sessions[token] = session;
        SaveSessions();

        return new LoginResponse
        {
            Success = true,
            Message = "Erfolgreich angemeldet!",
            Token = token,
            Username = settings.AdminUsername,
            AuthMethod = "local"
        };
    }

    public async Task<LoginResponse> DiscordLoginAsync(string code, string? redirectUri)
    {
        try
        {
            var config = await _discordService.GetConfigAsync();
            var targetRedirectUri = string.IsNullOrWhiteSpace(redirectUri) ? config.RedirectUri : redirectUri;
            var profile = await _discordService.HandleOAuthCallbackAsync(code, targetRedirectUri);
            if (string.IsNullOrWhiteSpace(profile.Id))
            {
                return new LoginResponse { Success = false, Message = "Discord-Profil konnte nicht geladen werden." };
            }

            var token = Guid.NewGuid().ToString("N");
            var session = new AuthSession
            {
                Token = token,
                Username = profile.GlobalName ?? profile.Username,
                AuthMethod = "discord",
                AvatarUrl = profile.AvatarUrl,
                CreatedAt = DateTime.UtcNow,
                ExpiresAt = DateTime.UtcNow.AddDays(7)
            };

            _sessions[token] = session;
            SaveSessions();

            return new LoginResponse
            {
                Success = true,
                Message = $"Willkommen zurück, {session.Username}!",
                Token = token,
                Username = session.Username,
                AuthMethod = "discord",
                AvatarUrl = session.AvatarUrl
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Discord Login failed");
            return new LoginResponse { Success = false, Message = $"Discord-Anmeldung fehlgeschlagen: {ex.Message}" };
        }
    }

    public async Task<LoginResponse> SetupWizardAsync(SetupWizardRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AdminUsername) || string.IsNullOrWhiteSpace(request.AdminPassword))
        {
            return new LoginResponse { Success = false, Message = "Admin-Benutzername und Passwort sind erforderlich." };
        }

        if (request.AdminPassword.Length < 4)
        {
            return new LoginResponse { Success = false, Message = "Das Passwort muss mindestens 4 Zeichen lang sein." };
        }

        var (hash, salt) = HashPassword(request.AdminPassword);

        var settings = await GetSettingsAsync();
        if (settings.IsConfigured || settings.SetupCompletedAt != null)
        {
            return new LoginResponse 
            { 
                Success = false, 
                Message = "Das Setup wurde bereits abgeschlossen und ist gesperrt. Änderungen können über die Einstellungen im Dashboard vorgenommen werden." 
            };
        }

        settings.IsConfigured = true;
        settings.AdminUsername = request.AdminUsername.Trim();
        settings.AdminPasswordHash = hash;
        settings.AdminPasswordSalt = salt;
        settings.ServerName = string.IsNullOrWhiteSpace(request.ServerName) ? "Minecraft Server" : request.ServerName.Trim();
        settings.Architecture = request.Architecture;
        settings.SetupCompletedAt = DateTime.UtcNow;

        // Configure Nodes based on selected Architecture
        var clusterConfig = await _clusterService.GetConfigAsync();
        clusterConfig.ClusterName = settings.ServerName;

        if (request.Architecture == ServerArchitecture.SingleServer)
        {
            var single = request.SingleServer ?? new SingleServerSetup();
            clusterConfig.Nodes = new List<ClusterNode>
            {
                new ClusterNode
                {
                    Id = "single_main",
                    Name = settings.ServerName,
                    Role = ServerRole.Overworld,
                    ServerType = ServerType.Paper,
                    Host = single.Host,
                    SshPort = single.SshPort > 0 ? single.SshPort : 22,
                    SshUsername = string.IsNullOrWhiteSpace(single.SshUsername) ? "root" : single.SshUsername.Trim(),
                    SshPassword = single.SshPassword,
                    MinecraftPort = single.MinecraftPort > 0 ? single.MinecraftPort : 25565,
                    MemoryAllocationMb = single.MemoryMb > 0 ? single.MemoryMb : 6144,
                    RemoteDirectory = string.IsNullOrWhiteSpace(single.RemoteDirectory) ? "/opt/minecraft/server" : single.RemoteDirectory.Trim(),
                    MinecraftVersion = string.IsNullOrWhiteSpace(single.MinecraftVersion) ? "1.21.1" : single.MinecraftVersion.Trim(),
                    Motd = $"&a&l{settings.ServerName} &8| &7Standalone Paper Server"
                }
            };
        }
        else
        {
            // Multi-Dimension Waterfall Cluster
            var cl = request.Cluster ?? new ClusterSetup();
            var masterHost = string.IsNullOrWhiteSpace(cl.MasterHost) ? "127.0.0.1" : cl.MasterHost.Trim();
            var masterUser = string.IsNullOrWhiteSpace(cl.MasterSshUsername) ? "root" : cl.MasterSshUsername.Trim();
            var masterPass = cl.MasterSshPassword;
            var masterPort = cl.MasterSshPort > 0 ? cl.MasterSshPort : 22;
            var proxyPort = cl.ProxyPublicPort > 0 ? cl.ProxyPublicPort : 25565;

            clusterConfig.ProxyPublicPort = proxyPort;
            clusterConfig.Nodes = new List<ClusterNode>
            {
                new ClusterNode
                {
                    Id = "proxy",
                    Name = "Waterfall Proxy",
                    Role = ServerRole.WaterfallProxy,
                    ServerType = ServerType.Waterfall,
                    Host = masterHost,
                    SshPort = masterPort,
                    SshUsername = masterUser,
                    SshPassword = masterPass,
                    MinecraftPort = proxyPort,
                    MemoryAllocationMb = 2048,
                    RemoteDirectory = "/opt/minecraft/waterfall",
                    MinecraftVersion = "1.20",
                    Motd = $"&b&l{settings.ServerName} &8- &7Dimension Gateway"
                },
                new ClusterNode
                {
                    Id = "lobby",
                    Name = "Hub / Lobby Server",
                    Role = ServerRole.Lobby,
                    ServerType = ServerType.Paper,
                    Host = masterHost,
                    SshPort = masterPort,
                    SshUsername = masterUser,
                    SshPassword = masterPass,
                    MinecraftPort = proxyPort == 25565 ? 25566 : proxyPort + 1,
                    MemoryAllocationMb = 3072,
                    RemoteDirectory = "/opt/minecraft/lobby",
                    MinecraftVersion = "1.21.1",
                    Motd = "&aHaupt-Lobby & Dimension Hub"
                },
                new ClusterNode
                {
                    Id = "overworld",
                    Name = "Overworld Dimension",
                    Role = ServerRole.Overworld,
                    ServerType = ServerType.Paper,
                    Host = masterHost,
                    SshPort = masterPort,
                    SshUsername = masterUser,
                    SshPassword = masterPass,
                    MinecraftPort = proxyPort == 25565 ? 25567 : proxyPort + 2,
                    MemoryAllocationMb = 6144,
                    RemoteDirectory = "/opt/minecraft/overworld",
                    MinecraftVersion = "1.21.1",
                    Motd = "&2Overworld Survival Dimension"
                },
                new ClusterNode
                {
                    Id = "nether",
                    Name = "Nether Dimension",
                    Role = ServerRole.Nether,
                    ServerType = ServerType.Paper,
                    Host = masterHost,
                    SshPort = masterPort,
                    SshUsername = masterUser,
                    SshPassword = masterPass,
                    MinecraftPort = proxyPort == 25565 ? 25568 : proxyPort + 3,
                    MemoryAllocationMb = 4096,
                    RemoteDirectory = "/opt/minecraft/nether",
                    MinecraftVersion = "1.21.1",
                    Motd = "&cNether Dimension &8- &4Hell"
                },
                new ClusterNode
                {
                    Id = "the_end",
                    Name = "The End Dimension",
                    Role = ServerRole.End,
                    ServerType = ServerType.Paper,
                    Host = masterHost,
                    SshPort = masterPort,
                    SshUsername = masterUser,
                    SshPassword = masterPass,
                    MinecraftPort = proxyPort == 25565 ? 25569 : proxyPort + 4,
                    MemoryAllocationMb = 4096,
                    RemoteDirectory = "/opt/minecraft/the_end",
                    MinecraftVersion = "1.21.1",
                    Motd = "&5The End Dimension &8- &dVoid"
                }
            };
        }

        await _clusterService.SaveConfigAsync(clusterConfig);

        // Optional Discord integration
        if (request.EnableDiscord && !string.IsNullOrWhiteSpace(request.DiscordClientId))
        {
            var discord = await _discordService.GetConfigAsync();
            discord.IsEnabled = true;
            discord.ClientId = request.DiscordClientId.Trim();
            if (!string.IsNullOrWhiteSpace(request.DiscordClientSecret)) discord.ClientSecret = request.DiscordClientSecret.Trim();
            if (!string.IsNullOrWhiteSpace(request.DiscordGuildId)) discord.GuildId = request.DiscordGuildId.Trim();
            await _discordService.SaveConfigAsync(discord);
            settings.DiscordOAuthEnabled = true;
        }

        await SaveSettingsInternalAsync(settings);

        // Issue login session immediately
        var token = Guid.NewGuid().ToString("N");
        _sessions[token] = new AuthSession
        {
            Token = token,
            Username = settings.AdminUsername,
            AuthMethod = "local",
            CreatedAt = DateTime.UtcNow,
            ExpiresAt = DateTime.UtcNow.AddDays(7)
        };
        SaveSessions();

        return new LoginResponse
        {
            Success = true,
            Message = "Setup erfolgreich abgeschlossen! Willkommen im Dashboard.",
            Token = token,
            Username = settings.AdminUsername,
            AuthMethod = "local"
        };
    }

    public async Task<bool> ValidateTokenAsync(string token)
    {
        if (string.IsNullOrWhiteSpace(token)) return false;
        if (_sessions.TryGetValue(token, out var session))
        {
            if (session.ExpiresAt > DateTime.UtcNow) return true;
            _sessions.TryRemove(token, out _);
        }
        return false;
    }

    public Task LogoutAsync(string token)
    {
        if (!string.IsNullOrWhiteSpace(token))
        {
            _sessions.TryRemove(token, out _);
            SaveSessions();
        }
        return Task.CompletedTask;
    }

    public async Task<PluginOperationResult> UpdateSettingsAsync(UpdateSettingsRequest request)
    {
        var settings = await GetSettingsAsync();

        if (!string.IsNullOrWhiteSpace(request.ServerName))
        {
            settings.ServerName = request.ServerName.Trim();
            var cluster = await _clusterService.GetConfigAsync();
            cluster.ClusterName = settings.ServerName;
            await _clusterService.SaveConfigAsync(cluster);
        }

        if (request.Architecture.HasValue)
        {
            settings.Architecture = request.Architecture.Value;
        }

        if (request.DiscordOAuthEnabled.HasValue)
        {
            settings.DiscordOAuthEnabled = request.DiscordOAuthEnabled.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.NewAdminUsername))
        {
            settings.AdminUsername = request.NewAdminUsername.Trim();
        }

        if (!string.IsNullOrWhiteSpace(request.NewPassword))
        {
            if (string.IsNullOrWhiteSpace(request.CurrentPassword) || 
                !VerifyPassword(request.CurrentPassword, settings.AdminPasswordHash, settings.AdminPasswordSalt))
            {
                return new PluginOperationResult { Success = false, Message = "Das aktuelle Passwort ist nicht korrekt." };
            }

            var (hash, salt) = HashPassword(request.NewPassword);
            settings.AdminPasswordHash = hash;
            settings.AdminPasswordSalt = salt;
        }

        await SaveSettingsInternalAsync(settings);
        return new PluginOperationResult { Success = true, Message = "Einstellungen erfolgreich gespeichert." };
    }

    private async Task SaveSettingsInternalAsync(SystemSettings settings)
    {
        _cachedSettings = settings;
        var json = JsonSerializer.Serialize(settings, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_settingsFilePath, json);
    }

    private void LoadSessions()
    {
        try
        {
            if (File.Exists(_sessionsFilePath))
            {
                var json = File.ReadAllText(_sessionsFilePath);
                var list = JsonSerializer.Deserialize<List<AuthSession>>(json);
                if (list != null)
                {
                    foreach (var s in list.Where(s => s.ExpiresAt > DateTime.UtcNow))
                    {
                        _sessions[s.Token] = s;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not load saved sessions");
        }
    }

    private void SaveSessions()
    {
        try
        {
            var validSessions = _sessions.Values.Where(s => s.ExpiresAt > DateTime.UtcNow).ToList();
            var json = JsonSerializer.Serialize(validSessions, new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(_sessionsFilePath, json);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not save sessions");
        }
    }

    private static (string Hash, string Salt) HashPassword(string password)
    {
        var saltBytes = RandomNumberGenerator.GetBytes(16);
        var salt = Convert.ToBase64String(saltBytes);
        using var sha = SHA256.Create();
        var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(salt + password));
        return (Convert.ToBase64String(hashBytes), salt);
    }

    private static bool VerifyPassword(string password, string hash, string salt)
    {
        if (string.IsNullOrEmpty(hash) || string.IsNullOrEmpty(salt)) return false;
        using var sha = SHA256.Create();
        var hashBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(salt + password));
        return Convert.ToBase64String(hashBytes) == hash;
    }
}
