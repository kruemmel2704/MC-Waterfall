using Microsoft.AspNetCore.Mvc;
using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class WorldsController : ControllerBase
{
    private readonly IWorldManagerService _worldService;
    private readonly ILogger<WorldsController> _logger;

    public WorldsController(IWorldManagerService worldService, ILogger<WorldsController> logger)
    {
        _worldService = worldService;
        _logger = logger;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<WorldOverviewResponse>> GetOverview()
    {
        var overview = await _worldService.GetWorldOverviewAsync();
        return Ok(overview);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportWorlds()
    {
        try
        {
            var (stream, fileName, length) = await _worldService.ExportWorldsZipAsync();
            Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{fileName}\"");
            return File(stream, "application/zip", fileName);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to export worlds zip");
            return StatusCode(500, new { message = "Fehler beim Erstellen des Welt-Backups: " + ex.Message });
        }
    }

    [HttpPost("import")]
    [RequestSizeLimit(1024L * 1024L * 1024L * 2L)] // Up to 2 GB world zips
    [RequestFormLimits(MultipartBodyLengthLimit = 1024L * 1024L * 1024L * 2L)]
    public async Task<ActionResult<WorldImportResult>> ImportWorld(IFormFile? file)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new WorldImportResult { Success = false, Message = "Bitte eine gültige .zip Datei auswählen." });
        }

        if (!file.FileName.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(new WorldImportResult { Success = false, Message = "Nur .zip Dateien werden unterstützt." });
        }

        using var stream = file.OpenReadStream();
        var result = await _worldService.ImportWorldZipAsync(stream, file.FileName);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("reset")]
    public async Task<ActionResult<WorldResetResult>> ResetWorlds([FromBody] WorldResetRequest request)
    {
        if (request.Dimensions == null || request.Dimensions.Count == 0)
        {
            return BadRequest(new WorldResetResult { Success = false, Message = "Bitte mindestens eine Dimension zum Zurücksetzen auswählen." });
        }

        var result = await _worldService.ResetWorldsAsync(request);
        return Ok(result);
    }
}
