using System.Text;
using System.Text.RegularExpressions;
using McWaterfall.Backend.Models;
using Renci.SshNet;
using Renci.SshNet.Common;

namespace McWaterfall.Backend.Services;

public class SshService : ISshService
{
    private readonly ILogger<SshService> _logger;

    public SshService(ILogger<SshService> logger)
    {
        _logger = logger;
    }

    private Renci.SshNet.ConnectionInfo CreateConnectionInfo(ClusterNode node, int timeoutSeconds = 10)
    {
        var authMethods = new List<AuthenticationMethod>();

        if (!string.IsNullOrWhiteSpace(node.SshPrivateKey))
        {
            try
            {
                using var keyStream = new MemoryStream(Encoding.UTF8.GetBytes(node.SshPrivateKey));
                var keyFile = new PrivateKeyFile(keyStream);
                authMethods.Add(new PrivateKeyAuthenticationMethod(node.SshUsername, keyFile));
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse private key for node {NodeId}", node.Id);
            }
        }

        if (!string.IsNullOrWhiteSpace(node.SshPassword) || authMethods.Count == 0)
        {
            authMethods.Add(new PasswordAuthenticationMethod(node.SshUsername, node.SshPassword ?? string.Empty));
        }

        return new Renci.SshNet.ConnectionInfo(
            node.Host,
            node.SshPort > 0 ? node.SshPort : 22,
            node.SshUsername,
            authMethods.ToArray()
        )
        {
            Timeout = TimeSpan.FromSeconds(timeoutSeconds)
        };
    }

    public async Task<SshTestResult> TestConnectionAsync(ClusterNode node)
    {
        var result = new SshTestResult();
        try
        {
            var connInfo = CreateConnectionInfo(node, 8);
            using var client = new SshClient(connInfo);
            await Task.Run(() => client.Connect());

            if (!client.IsConnected)
            {
                result.Success = false;
                result.Message = "Verbindung konnte nicht hergestellt werden.";
                return result;
            }

            result.Success = true;
            result.Message = "SSH-Verbindung erfolgreich hergestellt!";

            // Probe OS
            var osCmd = client.RunCommand("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d '=' -f 2 | tr -d '\"' || uname -sr");
            result.OsInfo = osCmd.Result.Trim();

            // Probe Java
            var javaCmd = client.RunCommand("java -version 2>&1");
            var javaOut = javaCmd.Result.Trim();
            if (javaOut.Contains("version") || javaOut.Contains("build"))
            {
                result.JavaInstalled = true;
                var match = Regex.Match(javaOut, @"(?:openjdk|java)\s+(?:version\s+)?[""']?([0-9\._]+)[""']?");
                result.JavaVersion = match.Success ? match.Groups[1].Value : javaOut.Split('\n').FirstOrDefault()?.Trim();
            }
            else
            {
                result.JavaInstalled = false;
                result.JavaVersion = "Nicht installiert";
            }

            // Probe RAM
            var ramCmd = client.RunCommand("free -m | awk '/^Mem:/{print $2, $7}'");
            var ramParts = ramCmd.Result.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries);
            if (ramParts.Length >= 2 && long.TryParse(ramParts[0], out var total) && long.TryParse(ramParts[1], out var free))
            {
                result.MemoryTotalMb = total;
                result.MemoryFreeMb = free;
            }

            // Probe Disk Space (root or user dir)
            var diskCmd = client.RunCommand("df -BG / | awk 'NR==2 {print $4}' | tr -d 'G'");
            if (long.TryParse(diskCmd.Result.Trim(), out var diskAvail))
            {
                result.DiskFreeGb = diskAvail;
            }

            // Probe Screen or Tmux
            var screenCmd = client.RunCommand("which screen tmux 2>/dev/null");
            result.ScreenOrTmuxInstalled = !string.IsNullOrWhiteSpace(screenCmd.Result);

            client.Disconnect();
            return result;
        }
        catch (SshAuthenticationException)
        {
            result.Success = false;
            result.Message = "Authentifizierung fehlgeschlagen. Bitte Benutzername und Passwort/Key prüfen.";
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "SSH Connection test failed for node {NodeHost}", node.Host);
            result.Success = false;
            result.Message = $"SSH-Fehler: {ex.Message}";
            return result;
        }
    }

    public async Task<(int ExitCode, string StdOut, string StdErr)> ExecuteCommandAsync(ClusterNode node, string command, int timeoutSeconds = 60)
    {
        return await Task.Run(() =>
        {
            try
            {
                var connInfo = CreateConnectionInfo(node, 10);
                using var client = new SshClient(connInfo);
                client.Connect();

                using var cmd = client.CreateCommand(command);
                cmd.CommandTimeout = TimeSpan.FromSeconds(timeoutSeconds);
                var asyncRes = cmd.BeginExecute();
                asyncRes.AsyncWaitHandle.WaitOne(TimeSpan.FromSeconds(timeoutSeconds));

                var exitStatus = cmd.ExitStatus ?? -1;
                var stdOut = cmd.Result ?? string.Empty;
                var stdErr = cmd.Error ?? string.Empty;

                client.Disconnect();
                return (exitStatus, stdOut, stdErr);
            }
            catch (System.Net.Sockets.SocketException)
            {
                // Target host is offline / port unreachable, return quiet offline signal
                return (-1, string.Empty, "Host unreachable / connection refused");
            }
            catch (Renci.SshNet.Common.SshConnectionException)
            {
                return (-1, string.Empty, "SSH connection failed");
            }
            catch (Exception ex)
            {
                _logger.LogWarning("SSH command execution error on {Host}: {Message}", node.Host, ex.Message);
                return (-1, string.Empty, ex.Message);
            }
        });
    }

    public async Task UploadTextFileAsync(ClusterNode node, string remoteFilePath, string content)
    {
        await Task.Run(() =>
        {
            var connInfo = CreateConnectionInfo(node, 15);
            using var sftp = new SftpClient(connInfo);
            sftp.Connect();

            // Ensure parent directory exists
            var directory = Path.GetDirectoryName(remoteFilePath)?.Replace('\\', '/');
            if (!string.IsNullOrEmpty(directory))
            {
                EnsureDirectoryRecursive(sftp, directory);
            }

            using var memoryStream = new MemoryStream(Encoding.UTF8.GetBytes(content));
            sftp.UploadFile(memoryStream, remoteFilePath, true);

            sftp.Disconnect();
        });
    }

    public async Task UploadBinaryFileAsync(ClusterNode node, string remoteFilePath, Stream content)
    {
        await Task.Run(() =>
        {
            var connInfo = CreateConnectionInfo(node, 30);
            using var sftp = new SftpClient(connInfo);
            sftp.Connect();

            var directory = Path.GetDirectoryName(remoteFilePath)?.Replace('\\', '/');
            if (!string.IsNullOrEmpty(directory))
            {
                EnsureDirectoryRecursive(sftp, directory);
            }

            sftp.UploadFile(content, remoteFilePath, true);
            sftp.Disconnect();
        });
    }

    public async Task UploadBinaryFileAsync(ClusterNode node, string remoteFilePath, byte[] content)
    {
        using var memoryStream = new MemoryStream(content);
        await UploadBinaryFileAsync(node, remoteFilePath, memoryStream);
    }

    public async Task<string> ReadTextFileAsync(ClusterNode node, string remoteFilePath)
    {
        return await Task.Run(() =>
        {
            var connInfo = CreateConnectionInfo(node, 15);
            using var sftp = new SftpClient(connInfo);
            sftp.Connect();

            if (!sftp.Exists(remoteFilePath))
            {
                sftp.Disconnect();
                return string.Empty;
            }

            using var stream = new MemoryStream();
            sftp.DownloadFile(remoteFilePath, stream);
            sftp.Disconnect();

            return Encoding.UTF8.GetString(stream.ToArray());
        });
    }

    public async Task<bool> FileExistsAsync(ClusterNode node, string remoteFilePath)
    {
        return await Task.Run(() =>
        {
            try
            {
                var connInfo = CreateConnectionInfo(node, 10);
                using var sftp = new SftpClient(connInfo);
                sftp.Connect();
                var exists = sftp.Exists(remoteFilePath);
                sftp.Disconnect();
                return exists;
            }
            catch
            {
                return false;
            }
        });
    }

    public async Task<string> GetLatestLogSnippetAsync(ClusterNode node, int lines = 100)
    {
        var logFile = $"{node.RemoteDirectory.TrimEnd('/')}/logs/latest.log";
        var proxyLogFile = $"{node.RemoteDirectory.TrimEnd('/')}/proxy.log";

        // Try latest.log first, or proxy.log for Waterfall
        var cmd = $"tail -n {lines} '{logFile}' 2>/dev/null || tail -n {lines} '{proxyLogFile}' 2>/dev/null || echo 'Keine Logdatei gefunden.'";
        var res = await ExecuteCommandAsync(node, cmd, 10);
        return string.IsNullOrWhiteSpace(res.StdOut) ? res.StdErr : res.StdOut;
    }

    private void EnsureDirectoryRecursive(SftpClient sftp, string path)
    {
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var current = "";
        foreach (var part in parts)
        {
            current += "/" + part;
            if (!sftp.Exists(current))
            {
                try
                {
                    sftp.CreateDirectory(current);
                }
                catch
                {
                    // Directory might already exist or permissions issue handled upstream
                }
            }
        }
    }
}
