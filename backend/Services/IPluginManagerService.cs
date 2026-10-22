using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IPluginManagerService
{
    Task<ModrinthSearchResponse> SearchModrinthAsync(string query, string? loader = null, string? gameVersion = null, int limit = 20, int offset = 0);
    Task<List<ModrinthVersion>> GetModrinthVersionsAsync(string projectSlugOrId, string? loader = null, string? gameVersion = null);
    Task<List<InstalledPlugin>> GetInstalledPluginsAsync(string nodeId);
    Task<PluginOperationResult> InstallPluginAsync(InstallPluginRequest request);
    Task<PluginOperationResult> TogglePluginAsync(TogglePluginRequest request);
    Task<PluginOperationResult> DeletePluginAsync(string nodeId, string fileName);
}
