using McWaterfall.Backend.Hubs;
using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClusterController : ControllerBase
{
    private readonly IClusterManagerService _clusterService;
    private readonly ISshService _sshService;
    private readonly IHubContext<ClusterHub> _hubContext;
    private readonly ILogger<ClusterController> _logger;

    public ClusterController(
        IClusterManagerService clusterService,
        ISshService sshService,
        IHubContext<ClusterHub> hubContext,
        ILogger<ClusterController> logger)
    {
        _clusterService = clusterService;
        _sshService = sshService;
        _hubContext = hubContext;
        _logger = logger;
    }

    [HttpGet]
    public async Task<ActionResult<ClusterConfig>> GetCluster()
    {
        var config = await _clusterService.GetConfigAsync();
        return Ok(config);
    }

    [HttpPut]
    public async Task<IActionResult> UpdateCluster([FromBody] ClusterConfig config)
    {
        await _clusterService.SaveConfigAsync(config);
        return Ok(config);
    }

    [HttpPost("node")]
    public async Task<ActionResult<ClusterNode>> AddOrUpdateNode([FromBody] ClusterNode node)
    {
        var updated = await _clusterService.AddOrUpdateNodeAsync(node);
        return Ok(updated);
    }

    [HttpDelete("node/{id}")]
    public async Task<IActionResult> DeleteNode(string id)
    {
        var success = await _clusterService.DeleteNodeAsync(id);
        return success ? Ok() : NotFound();
    }

    [HttpPost("node/{id}/test-ssh")]
    public async Task<ActionResult<SshTestResult>> TestSsh(string id)
    {
        var node = await _clusterService.GetNodeAsync(id);
        if (node == null) return NotFound("Knoten nicht gefunden.");

        var result = await _sshService.TestConnectionAsync(node);
        return Ok(result);
    }

    [HttpPost("test-ssh-raw")]
    public async Task<ActionResult<SshTestResult>> TestSshRaw([FromBody] ClusterNode tempNode)
    {
        var result = await _sshService.TestConnectionAsync(tempNode);
        return Ok(result);
    }

    [HttpPost("node/{id}/start")]
    public async Task<IActionResult> StartNode(string id)
    {
        var ok = await _clusterService.StartNodeAsync(id);
        return Ok(new { success = ok });
    }

    [HttpPost("node/{id}/stop")]
    public async Task<IActionResult> StopNode(string id)
    {
        var ok = await _clusterService.StopNodeAsync(id);
        return Ok(new { success = ok });
    }

    [HttpPost("node/{id}/restart")]
    public async Task<IActionResult> RestartNode(string id)
    {
        var ok = await _clusterService.RestartNodeAsync(id);
        return Ok(new { success = ok });
    }

    [HttpPost("start-all")]
    public async Task<IActionResult> StartAll()
    {
        await _clusterService.StartClusterAsync();
        return Ok(new { message = "Cluster-Startsequenz initiiert." });
    }

    [HttpPost("stop-all")]
    public async Task<IActionResult> StopAll()
    {
        await _clusterService.StopClusterAsync();
        return Ok(new { message = "Cluster-Stoppsequenz initiiert." });
    }

    [HttpPost("sync-waterfall")]
    public async Task<IActionResult> SyncWaterfall()
    {
        var ok = await _clusterService.SyncWaterfallConfigAsync();
        return Ok(new { success = ok });
    }

    [HttpGet("status")]
    public async Task<ActionResult<List<NodeLiveMetrics>>> GetStatus()
    {
        var status = await _clusterService.RefreshAllStatusAsync();
        return Ok(status);
    }

    [HttpGet("node/{id}/logs")]
    public async Task<ActionResult<string>> GetNodeLogs(string id, [FromQuery] int lines = 100)
    {
        var node = await _clusterService.GetNodeAsync(id);
        if (node == null) return NotFound("Knoten nicht gefunden.");

        var logs = await _sshService.GetLatestLogSnippetAsync(node, lines);
        return Ok(new { logs });
    }

    [HttpPost("node/{id}/command")]
    public async Task<IActionResult> SendCommand(string id, [FromBody] ConsoleCommandRequest req)
    {
        var res = await _clusterService.SendCommandAsync(id, req.Command);
        await _hubContext.Clients.Group($"console_{id}").SendAsync("ConsoleOutput", id, $"> {req.Command}\n{res}\n");
        return Ok(new { output = res });
    }
}
