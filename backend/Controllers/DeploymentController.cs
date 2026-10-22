using McWaterfall.Backend.Hubs;
using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DeploymentController : ControllerBase
{
    private readonly IMinecraftDeploymentService _deploymentService;
    private readonly IClusterManagerService _clusterService;
    private readonly IHubContext<ClusterHub> _hubContext;
    private readonly ILogger<DeploymentController> _logger;

    public DeploymentController(
        IMinecraftDeploymentService deploymentService,
        IClusterManagerService clusterService,
        IHubContext<ClusterHub> hubContext,
        ILogger<DeploymentController> logger)
    {
        _deploymentService = deploymentService;
        _clusterService = clusterService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpPost("deploy-node/{id}")]
    public async Task<ActionResult<List<DeploymentLog>>> DeployNode(string id, [FromBody] DeploymentRequest? request)
    {
        var node = await _clusterService.GetNodeAsync(id);
        if (node == null) return NotFound("Knoten nicht gefunden.");

        var clusterConfig = await _clusterService.GetConfigAsync();
        var installJava = request?.InstallJavaIfMissing ?? true;

        var logs = await _deploymentService.DeployNodeAsync(node, clusterConfig, installJava, async log =>
        {
            await _hubContext.Clients.All.SendAsync("DeploymentProgress", log);
        });

        await _clusterService.AddOrUpdateNodeAsync(node);
        var success = !logs.Any(l => !l.Success);
        await _hubContext.Clients.All.SendAsync("DeploymentCompleted", new { nodeId = id, success, logs });
        return Ok(logs);
    }

    [HttpPost("deploy-cluster")]
    public async Task<ActionResult<List<DeploymentLog>>> DeployCluster([FromBody] DeploymentRequest? request)
    {
        var clusterConfig = await _clusterService.GetConfigAsync();
        var installJava = request?.InstallJavaIfMissing ?? true;

        var logs = await _deploymentService.DeployClusterAsync(clusterConfig, installJava, async log =>
        {
            await _hubContext.Clients.All.SendAsync("DeploymentProgress", log);
        });

        await _clusterService.SaveConfigAsync(clusterConfig);
        var success = !logs.Any(l => !l.Success);
        await _hubContext.Clients.All.SendAsync("DeploymentCompleted", new { success, logs });
        return Ok(logs);
    }

    [HttpGet("preview-waterfall-config")]
    public async Task<ActionResult<string>> PreviewWaterfallConfig()
    {
        var config = await _clusterService.GetConfigAsync();
        var proxy = config.Nodes.FirstOrDefault(n => n.Role == ServerRole.WaterfallProxy) ?? config.Nodes.First();
        var yml = _deploymentService.GenerateWaterfallConfig(config, proxy);
        return Ok(new { config = yml });
    }
}
