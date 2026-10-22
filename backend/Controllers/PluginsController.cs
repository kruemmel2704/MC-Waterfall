using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PluginsController : ControllerBase
{
    private readonly IPluginManagerService _pluginService;
    private readonly ILogger<PluginsController> _logger;

    public PluginsController(IPluginManagerService pluginService, ILogger<PluginsController> logger)
    {
        _pluginService = pluginService;
        _logger = logger;
    }

    [HttpGet("search")]
    public async Task<ActionResult<ModrinthSearchResponse>> Search(
        [FromQuery] string? query,
        [FromQuery] string? loader,
        [FromQuery] string? version,
        [FromQuery] int limit = 20,
        [FromQuery] int offset = 0)
    {
        var result = await _pluginService.SearchModrinthAsync(query ?? string.Empty, loader, version, limit, offset);
        return Ok(result);
    }

    [HttpGet("versions/{projectSlug}")]
    public async Task<ActionResult<List<ModrinthVersion>>> GetVersions(
        string projectSlug,
        [FromQuery] string? loader,
        [FromQuery] string? version)
    {
        var versions = await _pluginService.GetModrinthVersionsAsync(projectSlug, loader, version);
        return Ok(versions);
    }

    [HttpGet("installed/{nodeId}")]
    public async Task<ActionResult<List<InstalledPlugin>>> GetInstalled(string nodeId)
    {
        var plugins = await _pluginService.GetInstalledPluginsAsync(nodeId);
        return Ok(plugins);
    }

    [HttpPost("install")]
    public async Task<ActionResult<PluginOperationResult>> Install([FromBody] InstallPluginRequest request)
    {
        var result = await _pluginService.InstallPluginAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("toggle")]
    public async Task<ActionResult<PluginOperationResult>> Toggle([FromBody] TogglePluginRequest request)
    {
        var result = await _pluginService.TogglePluginAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpDelete("delete/{nodeId}/{fileName}")]
    public async Task<ActionResult<PluginOperationResult>> Delete(string nodeId, string fileName)
    {
        var result = await _pluginService.DeletePluginAsync(nodeId, fileName);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }
}
