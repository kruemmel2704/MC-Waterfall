using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class RoleSyncBackgroundService : BackgroundService
{
    private readonly IDiscordService _discordService;
    private readonly ILogger<RoleSyncBackgroundService> _logger;

    public RoleSyncBackgroundService(
        IDiscordService discordService,
        ILogger<RoleSyncBackgroundService> logger)
    {
        _discordService = discordService;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Discord RoleSyncBackgroundService aktiv (Standard-Intervall: alle 5 Minuten).");

        // Kurz warten, bis Server und Discord-Verbindungen initialisiert sind
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(20), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var config = await _discordService.GetConfigAsync();
                var intervalMinutes = config.AutoSyncIntervalMinutes > 0 ? config.AutoSyncIntervalMinutes : 5;

                if (config.IsEnabled && config.EnableRoleSync && 
                    !string.IsNullOrWhiteSpace(config.GuildId) && 
                    !string.IsNullOrWhiteSpace(config.BotToken))
                {
                    var mappings = config.RoleMappings?.Where(m => m.AutoSync).ToList() ?? new List<DiscordRoleMapping>();
                    if (mappings.Count > 0)
                    {
                        _logger.LogInformation("Starte automatischen {Interval}-Minuten Discord-Rollen-Sync...", intervalMinutes);
                        var result = await _discordService.SyncAllPlayersRolesAsync();
                        _logger.LogInformation("Automatischer Rollen-Sync fertig: {Message} ({Count} synchronisiert)", result.Message, result.PlayersSynced);
                    }
                }

                await Task.Delay(TimeSpan.FromMinutes(intervalMinutes), stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unerwarteter Fehler im automatischen Discord-Rollen-Sync Hintergrunddienst");
                try
                {
                    await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
            }
        }

        _logger.LogInformation("RoleSyncBackgroundService gestoppt.");
    }
}
