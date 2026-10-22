using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IWorldManagerService
{
    Task<WorldOverviewResponse> GetWorldOverviewAsync();
    Task<(Stream Stream, string FileName, long Length)> ExportWorldsZipAsync();
    Task<WorldImportResult> ImportWorldZipAsync(Stream zipStream, string fileName);
    Task<WorldResetResult> ResetWorldsAsync(WorldResetRequest request);
}
