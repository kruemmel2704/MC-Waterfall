using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public interface ISshService
{
    Task<SshTestResult> TestConnectionAsync(ClusterNode node);
    Task<(int ExitCode, string StdOut, string StdErr)> ExecuteCommandAsync(ClusterNode node, string command, int timeoutSeconds = 60);
    Task UploadTextFileAsync(ClusterNode node, string remoteFilePath, string content);
    Task UploadBinaryFileAsync(ClusterNode node, string remoteFilePath, Stream content);
    Task UploadBinaryFileAsync(ClusterNode node, string remoteFilePath, byte[] content);
    Task<string> ReadTextFileAsync(ClusterNode node, string remoteFilePath);
    Task<bool> FileExistsAsync(ClusterNode node, string remoteFilePath);
    Task<string> GetLatestLogSnippetAsync(ClusterNode node, int lines = 100);
}
