using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IAuthService
{
    Task<SystemSettings> GetSettingsAsync();
    Task<AuthStatusResponse> GetStatusAsync(string? sessionToken);
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<LoginResponse> DiscordLoginAsync(string code, string? redirectUri);
    Task<LoginResponse> SetupWizardAsync(SetupWizardRequest request);
    Task<bool> ValidateTokenAsync(string token);
    Task LogoutAsync(string token);
    Task<PluginOperationResult> UpdateSettingsAsync(UpdateSettingsRequest request);
}
