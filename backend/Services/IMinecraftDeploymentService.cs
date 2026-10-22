using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface IMinecraftDeploymentService
{
    Task<List<DeploymentLog>> DeployNodeAsync(
        ClusterNode node, 
        ClusterConfig clusterConfig, 
        bool installJavaIfMissing,
        Action<DeploymentLog>? onProgress = null
    );

    Task<List<DeploymentLog>> DeployClusterAsync(
        ClusterConfig clusterConfig, 
        bool installJavaIfMissing,
        Action<DeploymentLog>? onProgress = null
    );

    string GenerateWaterfallConfig(ClusterConfig clusterConfig, ClusterNode proxyNode);
    string GenerateServerProperties(ClusterNode node);
    string GenerateSpigotConfig(ClusterNode node, string? customKickMessage = null);
    string GeneratePaperGlobalConfig(ClusterNode node);
    string GenerateRunScript(ClusterNode node);
}
