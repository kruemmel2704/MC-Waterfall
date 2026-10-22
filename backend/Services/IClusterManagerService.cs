using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IClusterManagerService
{
    Task<ClusterConfig> GetConfigAsync();
    Task SaveConfigAsync(ClusterConfig config);
    Task<ClusterNode?> GetNodeAsync(string nodeId);
    Task<ClusterNode> AddOrUpdateNodeAsync(ClusterNode node);
    Task<bool> DeleteNodeAsync(string nodeId);
    
    Task<bool> StartNodeAsync(string nodeId);
    Task<bool> StopNodeAsync(string nodeId);
    Task<bool> RestartNodeAsync(string nodeId);
    Task<string> SendCommandAsync(string nodeId, string command);
    
    Task StartClusterAsync();
    Task StopClusterAsync();
    Task<bool> SyncWaterfallConfigAsync();
    
    Task<NodeLiveMetrics> RefreshNodeStatusAsync(string nodeId);
    Task<List<NodeLiveMetrics>> RefreshAllStatusAsync();
}
