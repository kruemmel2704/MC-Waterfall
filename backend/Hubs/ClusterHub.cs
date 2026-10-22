using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.SignalR;

namespace McWaterfall.Backend.Hubs;

public class ClusterHub : Hub
{
    private readonly ISshService _sshService;
    private readonly IClusterManagerService _clusterService;
    private readonly ILogger<ClusterHub> _logger;

    public ClusterHub(ISshService sshService, IClusterManagerService clusterService, ILogger<ClusterHub> logger)
    {
        _sshService = sshService;
        _clusterService = clusterService;
        _logger = logger;
    }

    public async Task JoinNodeConsole(string nodeId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"console_{nodeId}");
        
        // Send initial log snippet
        var node = await _clusterService.GetNodeAsync(nodeId);
        if (node != null)
        {
            var initialLogs = await _sshService.GetLatestLogSnippetAsync(node, 60);
            await Clients.Caller.SendAsync("ConsoleOutput", nodeId, initialLogs);
        }
    }

    public async Task LeaveNodeConsole(string nodeId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"console_{nodeId}");
    }

    public async Task SendConsoleCommand(string nodeId, string command)
    {
        _logger.LogInformation("Console command received for node {NodeId}: {Command}", nodeId, command);
        var result = await _clusterService.SendCommandAsync(nodeId, command);
        
        await Clients.Group($"console_{nodeId}").SendAsync("ConsoleOutput", nodeId, $"> {command}\n{result}\n");
    }
}
