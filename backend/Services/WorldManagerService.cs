using System.Formats.Tar;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class WorldManagerService : IWorldManagerService
{
    private readonly ISshService _sshService;
    private readonly IClusterManagerService _clusterService;
    private readonly ILogger<WorldManagerService> _logger;

    public WorldManagerService(
        ISshService sshService,
        IClusterManagerService clusterService,
        ILogger<WorldManagerService> logger)
    {
        _sshService = sshService;
        _clusterService = clusterService;
        _logger = logger;
    }

    public async Task<WorldOverviewResponse> GetWorldOverviewAsync()
    {
        var cluster = await _clusterService.GetConfigAsync();
        var response = new WorldOverviewResponse
        {
            ClusterName = cluster.ClusterName,
            Architecture = cluster.Nodes.Count > 2 ? "DimensionalCluster" : "SingleServer"
        };

        var backendNodes = cluster.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();
        long totalSize = 0;

        foreach (var node in backendNodes)
        {
            var levelName = GetLevelNameForNode(node);
            var dimKey = GetDimensionKeyForNode(node);
            var dimName = GetDimensionNameForNode(node);

            var info = new WorldDimensionInfo
            {
                DimensionKey = dimKey,
                DimensionName = dimName,
                NodeId = node.Id,
                WorldFolderName = levelName,
                Exists = false,
                SizeBytes = 0,
                RegionFileCount = 0
            };

            try
            {
                var targetDir = $"{node.RemoteDirectory.TrimEnd('/')}/{levelName}";
                var probeCmd = $"if [ -d '{targetDir}' ]; then du -sb '{targetDir}' 2>/dev/null | cut -f1; find '{targetDir}/region' -type f -name '*.mca' 2>/dev/null | wc -l; date -r '{targetDir}' +%s 2>/dev/null; else echo '0\n0\n0'; fi";
                var (exit, stdOut, _) = await _sshService.ExecuteCommandAsync(node, probeCmd, 10);

                if (exit == 0 && !string.IsNullOrWhiteSpace(stdOut))
                {
                    var lines = stdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
                    if (lines.Length >= 2 && long.TryParse(lines[0], out var size) && size > 0)
                    {
                        info.Exists = true;
                        info.SizeBytes = size;
                        totalSize += size;

                        if (int.TryParse(lines[1], out var regions))
                        {
                            info.RegionFileCount = regions;
                        }

                        if (lines.Length >= 3 && long.TryParse(lines[2], out var unixSec) && unixSec > 0)
                        {
                            info.LastModified = DateTimeOffset.FromUnixTimeSeconds(unixSec).UtcDateTime;
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to probe world stats for node {NodeId}", node.Id);
            }

            response.Dimensions.Add(info);
        }

        response.TotalSizeBytes = totalSize;
        return response;
    }

    public async Task<(Stream Stream, string FileName, long Length)> ExportWorldsZipAsync()
    {
        var cluster = await _clusterService.GetConfigAsync();
        var tempZipPath = Path.Combine(Path.GetTempPath(), $"cluster_worlds_{Guid.NewGuid():N}.zip");
        var backendNodes = cluster.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy).ToList();

        try
        {
            using (var zipFile = new FileStream(tempZipPath, FileMode.Create, FileAccess.Write, FileShare.None))
            using (var zipArchive = new ZipArchive(zipFile, ZipArchiveMode.Create, false))
            {
                foreach (var node in backendNodes)
                {
                    var levelName = GetLevelNameForNode(node);
                    var dimKey = GetDimensionKeyForNode(node);
                    var targetDir = $"{node.RemoteDirectory.TrimEnd('/')}/{levelName}";

                    try
                    {
                        // 1. Flush memory chunks to disk safely
                        await _clusterService.SendCommandAsync(node.Id, "save-off");
                        await _clusterService.SendCommandAsync(node.Id, "save-all");
                        await Task.Delay(1000);

                        // 2. Tar the world directory on the remote machine
                        var tarGzRemote = $"/tmp/exp_{node.Id}_{DateTime.UtcNow.Ticks}.tar.gz";
                        var tarCmd = $"if [ -d '{targetDir}' ]; then tar -czf '{tarGzRemote}' -C '{node.RemoteDirectory.TrimEnd('/')}' '{levelName}'; echo 'OK'; else echo 'NOT_FOUND'; fi";
                        var (exit, stdOut, _) = await _sshService.ExecuteCommandAsync(node, tarCmd, 60);

                        // Re-enable autosave
                        await _clusterService.SendCommandAsync(node.Id, "save-on");

                        if (exit == 0 && stdOut.Contains("OK"))
                        {
                            // 3. Download tar.gz to memory stream
                            using var tarStream = new MemoryStream();
                            await _sshService.DownloadBinaryFileAsync(node, tarGzRemote, tarStream);
                            tarStream.Position = 0;

                            // Clean up remote tar
                            _ = _sshService.ExecuteCommandAsync(node, $"rm -f '{tarGzRemote}'", 5);

                            // 4. Unpack tar.gz into the main zip archive under dimKey/
                            using var gzipStream = new GZipStream(tarStream, CompressionMode.Decompress);
                            using var tarReader = new TarReader(gzipStream);

                            while (tarReader.GetNextEntry() is { } entry)
                            {
                                if (entry.EntryType == TarEntryType.RegularFile)
                                {
                                    // Strip leading folder (e.g. "world/region/r.0.0.mca" -> "region/r.0.0.mca")
                                    var relativePath = entry.Name;
                                    var firstSlash = relativePath.IndexOf('/');
                                    if (firstSlash >= 0)
                                    {
                                        relativePath = relativePath[(firstSlash + 1)..];
                                    }

                                    var zipEntryPath = $"{dimKey}/{relativePath}";
                                    var zipEntry = zipArchive.CreateEntry(zipEntryPath, CompressionLevel.Optimal);
                                    using var entryStream = zipEntry.Open();
                                    if (entry.DataStream != null)
                                    {
                                        await entry.DataStream.CopyToAsync(entryStream);
                                    }
                                }
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to export world for node {NodeId}", node.Id);
                    }
                }

                // Add metadata.json to zip
                var meta = new
                {
                    ClusterName = cluster.ClusterName,
                    ExportedAt = DateTime.UtcNow,
                    Dimensions = backendNodes.Select(n => new
                    {
                        NodeId = n.Id,
                        Dimension = GetDimensionKeyForNode(n),
                        WorldFolder = GetLevelNameForNode(n)
                    }).ToList()
                };
                var metaEntry = zipArchive.CreateEntry("metadata.json", CompressionLevel.Fastest);
                using (var metaWriter = new StreamWriter(metaEntry.Open(), Encoding.UTF8))
                {
                    await metaWriter.WriteAsync(JsonSerializer.Serialize(meta, new JsonSerializerOptions { WriteIndented = true }));
                }
            }

            var fileInfo = new FileInfo(tempZipPath);
            var resultStream = new FileStream(tempZipPath, FileMode.Open, FileAccess.Read, FileShare.Read, 4096, FileOptions.DeleteOnClose);
            var downloadName = $"{cluster.ClusterName.Replace(' ', '_').ToLowerInvariant()}_worlds_{DateTime.UtcNow:yyyyMMdd_HHmm}.zip";

            return (resultStream, downloadName, fileInfo.Length);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to create world export zip");
            if (File.Exists(tempZipPath)) File.Delete(tempZipPath);
            throw;
        }
    }

    public async Task<WorldImportResult> ImportWorldZipAsync(Stream zipStream, string fileName)
    {
        var result = new WorldImportResult();
        var tempUploadedZip = Path.Combine(Path.GetTempPath(), $"upload_{Guid.NewGuid():N}.zip");

        try
        {
            // 1. Save uploaded stream to temp file
            using (var tempFile = new FileStream(tempUploadedZip, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await zipStream.CopyToAsync(tempFile);
            }

            // 2. Analyze Zip contents and distribute by dimension
            var overworldFiles = new Dictionary<string, byte[]>();
            var netherFiles = new Dictionary<string, byte[]>();
            var endFiles = new Dictionary<string, byte[]>();
            var lobbyFiles = new Dictionary<string, byte[]>();

            using (var zipArchive = ZipFile.OpenRead(tempUploadedZip))
            {
                bool hasDimMinusOne = false;
                bool hasDimOne = false;
                bool hasSpigotNether = false;
                bool hasSpigotEnd = false;

                foreach (var entry in zipArchive.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name)) continue; // Directory entry

                    var norm = entry.FullName.Replace('\\', '/');

                    if (norm.Contains("/DIM-1/") || norm.StartsWith("DIM-1/")) hasDimMinusOne = true;
                    if (norm.Contains("/DIM1/") || norm.StartsWith("DIM1/")) hasDimOne = true;
                    if (norm.Contains("world_nether/") || norm.StartsWith("nether/")) hasSpigotNether = true;
                    if (norm.Contains("world_the_end/") || norm.StartsWith("the_end/") || norm.StartsWith("end/")) hasSpigotEnd = true;
                }

                if (hasDimMinusOne || hasDimOne)
                {
                    result.DetectedFormat = "Standard Vanilla / Singleplayer World (DIM-1 für Nether & DIM1 für The End)";
                }
                else if (hasSpigotNether || hasSpigotEnd)
                {
                    result.DetectedFormat = "Multi-Server Spigot / Paper Cluster (world, world_nether, world_the_end)";
                }
                else
                {
                    result.DetectedFormat = "Standard Overworld / Benutzerdefinierte Welt";
                }

                // Extract each file into appropriate dimension bucket
                foreach (var entry in zipArchive.Entries)
                {
                    if (string.IsNullOrEmpty(entry.Name)) continue;

                    var norm = entry.FullName.Replace('\\', '/');
                    using var s = entry.Open();
                    using var ms = new MemoryStream();
                    await s.CopyToAsync(ms);
                    var bytes = ms.ToArray();

                    // Nether check
                    if (norm.Contains("/DIM-1/") || norm.StartsWith("DIM-1/"))
                    {
                        var rel = ExtractRelativePathAfter(norm, "DIM-1/");
                        netherFiles[rel] = bytes;
                    }
                    else if (norm.StartsWith("world_nether/") || norm.StartsWith("nether/"))
                    {
                        var rel = StripFirstFolder(norm);
                        netherFiles[rel] = bytes;
                    }
                    // The End check
                    else if (norm.Contains("/DIM1/") || norm.StartsWith("DIM1/"))
                    {
                        var rel = ExtractRelativePathAfter(norm, "DIM1/");
                        endFiles[rel] = bytes;
                    }
                    else if (norm.StartsWith("world_the_end/") || norm.StartsWith("the_end/") || norm.StartsWith("end/"))
                    {
                        var rel = StripFirstFolder(norm);
                        endFiles[rel] = bytes;
                    }
                    // Lobby check
                    else if (norm.StartsWith("world_lobby/") || norm.StartsWith("lobby/"))
                    {
                        var rel = StripFirstFolder(norm);
                        lobbyFiles[rel] = bytes;
                    }
                    // Overworld check
                    else
                    {
                        var rel = norm;
                        if (rel.StartsWith("overworld/")) rel = StripFirstFolder(rel);
                        else if (rel.StartsWith("world/")) rel = StripFirstFolder(rel);
                        else
                        {
                            // Strip any outer root folder (e.g. "MySave/region/..." -> "region/...")
                            var parts = rel.Split('/', 2);
                            if (parts.Length > 1 && (parts[1].StartsWith("region/") || parts[1].StartsWith("poi/") || parts[1].StartsWith("entities/") || parts[1].StartsWith("data/") || parts[1] == "level.dat"))
                            {
                                rel = parts[1];
                            }
                        }
                        overworldFiles[rel] = bytes;
                    }
                }
            }

            result.OverworldFiles = overworldFiles.Count;
            result.NetherFiles = netherFiles.Count;
            result.EndFiles = endFiles.Count;
            result.LobbyFiles = lobbyFiles.Count;
            result.TotalFiles = overworldFiles.Count + netherFiles.Count + endFiles.Count + lobbyFiles.Count;

            // 3. Deploy each dimension to its respective cluster node
            var cluster = await _clusterService.GetConfigAsync();

            await DeployDimensionFilesAsync(cluster, ServerRole.Overworld, overworldFiles, result.Details);
            await DeployDimensionFilesAsync(cluster, ServerRole.Nether, netherFiles, result.Details);
            await DeployDimensionFilesAsync(cluster, ServerRole.End, endFiles, result.Details);
            if (lobbyFiles.Count > 0)
            {
                await DeployDimensionFilesAsync(cluster, ServerRole.Lobby, lobbyFiles, result.Details);
            }

            result.Success = true;
            result.Message = $"Welt-Import erfolgreich abgeschlossen! Format '{result.DetectedFormat}' wurde erkannt und aufgeteilt: {result.OverworldFiles} Overworld, {result.NetherFiles} Nether, {result.EndFiles} End.";
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to import world zip");
            result.Success = false;
            result.Message = $"Fehler beim Importieren der Welt: {ex.Message}";
            return result;
        }
        finally
        {
            if (File.Exists(tempUploadedZip))
            {
                try { File.Delete(tempUploadedZip); } catch { }
            }
        }
    }

    public async Task<WorldResetResult> ResetWorldsAsync(WorldResetRequest request)
    {
        var result = new WorldResetResult();
        var cluster = await _clusterService.GetConfigAsync();
        var isAll = request.Dimensions.Contains("all", StringComparer.OrdinalIgnoreCase);

        var targetRoles = new List<ServerRole>();
        if (isAll || request.Dimensions.Contains("overworld", StringComparer.OrdinalIgnoreCase)) targetRoles.Add(ServerRole.Overworld);
        if (isAll || request.Dimensions.Contains("nether", StringComparer.OrdinalIgnoreCase)) targetRoles.Add(ServerRole.Nether);
        if (isAll || request.Dimensions.Contains("the_end", StringComparer.OrdinalIgnoreCase) || request.Dimensions.Contains("end", StringComparer.OrdinalIgnoreCase)) targetRoles.Add(ServerRole.End);
        if (isAll || request.Dimensions.Contains("lobby", StringComparer.OrdinalIgnoreCase)) targetRoles.Add(ServerRole.Lobby);

        foreach (var role in targetRoles)
        {
            var node = cluster.Nodes.FirstOrDefault(n => n.Role == role);
            if (node == null) continue;

            var levelName = GetLevelNameForNode(node);
            var targetDir = $"{node.RemoteDirectory.TrimEnd('/')}/{levelName}";

            try
            {
                // 1. Stop node safely
                await _clusterService.SendCommandAsync(node.Id, "stop");
                await Task.Delay(2000);

                // 2. Backup or wipe world directory
                if (request.CreateBackupBeforeReset)
                {
                    var bakCmd = $"if [ -d '{targetDir}' ]; then mv '{targetDir}' '{targetDir}.bak_$(date +%Y%m%d_%H%M%S)'; echo 'BACKED_UP'; else echo 'SKIPPED'; fi";
                    var (bExit, bOut, _) = await _sshService.ExecuteCommandAsync(node, bakCmd, 15);
                    result.Details.Add($"{node.Name}: Altes Terrain gesichert & zurückgesetzt.");
                }
                else
                {
                    var rmCmd = $"rm -rf '{targetDir}'";
                    await _sshService.ExecuteCommandAsync(node, rmCmd, 15);
                    result.Details.Add($"{node.Name}: Terrain-Dateien vollständig gelöscht.");
                }

                // 3. Update seed if provided
                if (!string.IsNullOrWhiteSpace(request.CustomSeed))
                {
                    var propFile = $"{node.RemoteDirectory.TrimEnd('/')}/server.properties";
                    var seedCmd = $"sed -i 's/^level-seed=.*/level-seed={request.CustomSeed.Trim()}/' '{propFile}'";
                    await _sshService.ExecuteCommandAsync(node, seedCmd, 10);
                    result.Details.Add($"{node.Name}: Neuer Seed '{request.CustomSeed.Trim()}' in server.properties gesetzt.");
                }

                // 4. Restart node
                var restartCmd = $"cd '{node.RemoteDirectory.TrimEnd('/')}' && bash start.sh || screen -wipe";
                await _sshService.ExecuteCommandAsync(node, restartCmd, 10);
                result.Details.Add($"{node.Name}: Server neu gestartet (generiert neues Terrain).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to reset world for node {NodeId}", node.Id);
                result.Details.Add($"{node.Name}: Fehler beim Reset: {ex.Message}");
            }
        }

        result.Success = true;
        result.Message = "Welt-Reset erfolgreich durchgeführt! Die ausgewählten Dimensionen generieren beim Neustart neue Landschaften.";
        return result;
    }

    private async Task DeployDimensionFilesAsync(
        ClusterConfig cluster, 
        ServerRole role, 
        Dictionary<string, byte[]> files, 
        List<string> details)
    {
        if (files.Count == 0) return;

        var node = cluster.Nodes.FirstOrDefault(n => n.Role == role);
        if (node == null)
        {
            // If single server architecture, check single_main
            node = cluster.Nodes.FirstOrDefault(n => n.Role == ServerRole.Overworld);
            if (node == null) return;
        }

        var levelName = GetLevelNameForNode(node);
        var targetWorldDir = $"{node.RemoteDirectory.TrimEnd('/')}/{levelName}";

        // 1. Stop node safely
        await _clusterService.SendCommandAsync(node.Id, "stop");
        await Task.Delay(2500);

        // 2. Backup existing world folder
        var bakCmd = $"if [ -d '{targetWorldDir}' ]; then mv '{targetWorldDir}' '{targetWorldDir}.bak_$(date +%Y%m%d_%H%M%S)'; fi && mkdir -p '{targetWorldDir}'";
        await _sshService.ExecuteCommandAsync(node, bakCmd, 15);

        // 3. Create tar.gz in memory of the new dimension files
        using var tarMemStream = new MemoryStream();
        using (var gzip = new GZipStream(tarMemStream, CompressionLevel.Optimal, true))
        using (var tarWriter = new TarWriter(gzip))
        {
            foreach (var kvp in files)
            {
                var entry = new PaxTarEntry(TarEntryType.RegularFile, $"{levelName}/{kvp.Key}")
                {
                    DataStream = new MemoryStream(kvp.Value)
                };
                await tarWriter.WriteEntryAsync(entry);
            }
        }

        tarMemStream.Position = 0;
        var remoteTar = $"/tmp/imp_{node.Id}_{DateTime.UtcNow.Ticks}.tar.gz";

        // 4. Upload & Extract on remote node
        await _sshService.UploadBinaryFileAsync(node, remoteTar, tarMemStream);
        var extractCmd = $"tar -xzf '{remoteTar}' -C '{node.RemoteDirectory.TrimEnd('/')}' && rm -f '{remoteTar}'";
        var (exit, _, err) = await _sshService.ExecuteCommandAsync(node, extractCmd, 60);

        if (exit == 0)
        {
            details.Add($"{node.Name} ({role}): {files.Count} Dateien erfolgreich importiert ({levelName}).");
        }
        else
        {
            details.Add($"{node.Name} ({role}): Entpacken fehlgeschlagen: {err}");
        }

        // 5. Restart node
        var startCmd = $"cd '{node.RemoteDirectory.TrimEnd('/')}' && bash start.sh || screen -wipe";
        await _sshService.ExecuteCommandAsync(node, startCmd, 10);
    }

    private static string GetLevelNameForNode(ClusterNode node)
    {
        return node.Role switch
        {
            ServerRole.Nether => "world_nether",
            ServerRole.End => "world_the_end",
            ServerRole.Lobby => "world_lobby",
            _ => "world"
        };
    }

    private static string GetDimensionKeyForNode(ClusterNode node)
    {
        return node.Role switch
        {
            ServerRole.Nether => "nether",
            ServerRole.End => "the_end",
            ServerRole.Lobby => "lobby",
            _ => "overworld"
        };
    }

    private static string GetDimensionNameForNode(ClusterNode node)
    {
        return node.Role switch
        {
            ServerRole.Nether => "Nether Dimension",
            ServerRole.End => "The End Dimension",
            ServerRole.Lobby => "Lobby World",
            _ => "Overworld Dimension"
        };
    }

    private static string StripFirstFolder(string path)
    {
        var idx = path.IndexOf('/');
        return idx >= 0 ? path[(idx + 1)..] : path;
    }

    private static string ExtractRelativePathAfter(string path, string marker)
    {
        var idx = path.IndexOf(marker, StringComparison.OrdinalIgnoreCase);
        if (idx >= 0)
        {
            return path[(idx + marker.Length)..];
        }
        return path;
    }
}
