using System.Net.Http.Json;
using System.Text.Json;
using McWaterfall.Backend.Models;

namespace McWaterfall.Backend.Services;

public class PluginManagerService : IPluginManagerService
{
    private readonly HttpClient _httpClient;
    private readonly ISshService _sshService;
    private readonly IClusterManagerService _clusterService;
    private readonly ILogger<PluginManagerService> _logger;

    private const string ModrinthUserAgent = "McWaterfall/1.0 (admin@example.com)";

    public PluginManagerService(
        HttpClient httpClient,
        ISshService sshService,
        IClusterManagerService clusterService,
        ILogger<PluginManagerService> logger)
    {
        _httpClient = httpClient;
        _sshService = sshService;
        _clusterService = clusterService;
        _logger = logger;

        if (!_httpClient.DefaultRequestHeaders.Contains("User-Agent"))
        {
            _httpClient.DefaultRequestHeaders.Add("User-Agent", ModrinthUserAgent);
        }
    }

    public async Task<ModrinthSearchResponse> SearchModrinthAsync(
        string query, 
        string? loader = null, 
        string? gameVersion = null, 
        int limit = 20, 
        int offset = 0)
    {
        try
        {
            // Build facets query: [["project_type:plugin"], ...]
            var facetGroups = new List<List<string>>
            {
                new() { "project_type:plugin" }
            };

            if (!string.IsNullOrWhiteSpace(loader))
            {
                var l = loader.ToLowerInvariant();
                if (l == "paper" || l == "spigot")
                {
                    facetGroups.Add(new List<string> { "categories:paper", "categories:spigot", "categories:bukkit", "categories:folia" });
                }
                else if (l == "waterfall" || l == "bungeecord")
                {
                    facetGroups.Add(new List<string> { "categories:waterfall", "categories:bungeecord", "categories:velocity" });
                }
                else
                {
                    facetGroups.Add(new List<string> { $"categories:{l}" });
                }
            }

            if (!string.IsNullOrWhiteSpace(gameVersion))
            {
                facetGroups.Add(new List<string> { $"versions:{gameVersion}" });
            }

            var facetsJson = JsonSerializer.Serialize(facetGroups);
            var escapedQuery = Uri.EscapeDataString(query ?? string.Empty);
            var escapedFacets = Uri.EscapeDataString(facetsJson);

            var url = $"https://api.modrinth.com/v2/search?query={escapedQuery}&facets={escapedFacets}&limit={Math.Clamp(limit, 1, 50)}&offset={Math.Max(0, offset)}";

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("User-Agent", ModrinthUserAgent);

            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Modrinth search failed with status {Status}: {Body}", res.StatusCode, await res.Content.ReadAsStringAsync());
                return new ModrinthSearchResponse();
            }

            var searchResult = await res.Content.ReadFromJsonAsync<ModrinthSearchResponse>();
            return searchResult ?? new ModrinthSearchResponse();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error searching Modrinth for query '{Query}'", query);
            return new ModrinthSearchResponse();
        }
    }

    public async Task<List<ModrinthVersion>> GetModrinthVersionsAsync(
        string projectSlugOrId, 
        string? loader = null, 
        string? gameVersion = null)
    {
        try
        {
            var url = $"https://api.modrinth.com/v2/project/{Uri.EscapeDataString(projectSlugOrId)}/version";
            var queryParams = new List<string>();

            if (!string.IsNullOrWhiteSpace(loader))
            {
                var l = loader.ToLowerInvariant();
                var loadersList = (l == "waterfall" || l == "bungeecord") 
                    ? new[] { "waterfall", "bungeecord", "velocity" }
                    : new[] { l, "paper", "spigot", "bukkit" };
                queryParams.Add($"loaders={Uri.EscapeDataString(JsonSerializer.Serialize(loadersList))}");
            }

            if (!string.IsNullOrWhiteSpace(gameVersion))
            {
                queryParams.Add($"game_versions={Uri.EscapeDataString(JsonSerializer.Serialize(new[] { gameVersion }))}");
            }

            if (queryParams.Count > 0)
            {
                url += "?" + string.Join("&", queryParams);
            }

            using var req = new HttpRequestMessage(HttpMethod.Get, url);
            req.Headers.Add("User-Agent", ModrinthUserAgent);

            var res = await _httpClient.SendAsync(req);
            if (!res.IsSuccessStatusCode)
            {
                _logger.LogWarning("Modrinth get versions failed with status {Status}", res.StatusCode);
                return new List<ModrinthVersion>();
            }

            var versions = await res.Content.ReadFromJsonAsync<List<ModrinthVersion>>();
            return versions ?? new List<ModrinthVersion>();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error fetching versions for project '{Project}'", projectSlugOrId);
            return new List<ModrinthVersion>();
        }
    }

    public async Task<List<InstalledPlugin>> GetInstalledPluginsAsync(string nodeId)
    {
        var node = await _clusterService.GetNodeAsync(nodeId);
        if (node == null) return new List<InstalledPlugin>();

        var plugins = new List<InstalledPlugin>();
        var pluginsDir = $"{node.RemoteDirectory.TrimEnd('/')}/plugins";

        // Try clean find format first
        var findCmd = $"mkdir -p '{pluginsDir}' && find '{pluginsDir}' -maxdepth 1 -type f \\( -name '*.jar' -o -name '*.disabled' \\) -printf '%s\\t%T@\\t%f\\n' 2>/dev/null";
        var res = await _sshService.ExecuteCommandAsync(node, findCmd, 15);

        if (res.ExitCode == 0 && !string.IsNullOrWhiteSpace(res.StdOut))
        {
            var lines = res.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var line in lines)
            {
                var parts = line.Split('\t');
                if (parts.Length >= 3)
                {
                    long.TryParse(parts[0], out var size);
                    double.TryParse(parts[1], System.Globalization.CultureInfo.InvariantCulture, out var epoch);
                    var fileName = parts[2].Trim();

                    DateTime? modTime = null;
                    if (epoch > 0)
                    {
                        modTime = DateTimeOffset.FromUnixTimeSeconds((long)epoch).UtcDateTime;
                    }

                    var isEnabled = !fileName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase);
                    var cleanName = CleanPluginName(fileName);

                    plugins.Add(new InstalledPlugin
                    {
                        FileName = fileName,
                        PluginName = cleanName,
                        SizeBytes = size,
                        SizeFormatted = FormatFileSize(size),
                        IsEnabled = isEnabled,
                        LastModified = modTime
                    });
                }
            }
            return plugins.OrderBy(p => p.PluginName).ToList();
        }

        // Fallback to ls -la
        var lsCmd = $"mkdir -p '{pluginsDir}' && ls -la '{pluginsDir}' 2>/dev/null";
        var lsRes = await _sshService.ExecuteCommandAsync(node, lsCmd, 15);
        if (!string.IsNullOrWhiteSpace(lsRes.StdOut))
        {
            var lines = lsRes.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries);
            foreach (var line in lines)
            {
                var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 9)
                {
                    var fileName = parts[^1].Trim();
                    if (fileName.EndsWith(".jar", StringComparison.OrdinalIgnoreCase) || 
                        fileName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
                    {
                        long.TryParse(parts[4], out var size);
                        var isEnabled = !fileName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase);
                        plugins.Add(new InstalledPlugin
                        {
                            FileName = fileName,
                            PluginName = CleanPluginName(fileName),
                            SizeBytes = size,
                            SizeFormatted = FormatFileSize(size),
                            IsEnabled = isEnabled,
                            LastModified = null
                        });
                    }
                }
            }
        }

        return plugins.OrderBy(p => p.PluginName).ToList();
    }

    public async Task<PluginOperationResult> InstallPluginAsync(InstallPluginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.DownloadUrl) || string.IsNullOrWhiteSpace(request.FileName))
        {
            return new PluginOperationResult { Success = false, Message = "Download-URL und Dateiname erforderlich." };
        }

        var config = await _clusterService.GetConfigAsync();
        var targetNodes = new List<ClusterNode>();

        if (request.NodeId == "all")
        {
            targetNodes.AddRange(config.Nodes);
        }
        else if (request.NodeId == "all_paper")
        {
            targetNodes.AddRange(config.Nodes.Where(n => n.Role != ServerRole.WaterfallProxy));
        }
        else
        {
            var node = config.Nodes.FirstOrDefault(n => n.Id == request.NodeId);
            if (node != null) targetNodes.Add(node);
        }

        if (targetNodes.Count == 0)
        {
            return new PluginOperationResult { Success = false, Message = "Kein passender Zielserver gefunden." };
        }

        var affected = new List<string>();
        var errors = new List<string>();

        // Ensure clean jar filename
        var safeFileName = request.FileName.EndsWith(".jar", StringComparison.OrdinalIgnoreCase)
            ? request.FileName
            : request.FileName + ".jar";

        byte[]? cachedFileBytes = null;

        foreach (var node in targetNodes)
        {
            try
            {
                var pluginsDir = $"{node.RemoteDirectory.TrimEnd('/')}/plugins";
                var targetFile = $"{pluginsDir}/{safeFileName}";

                // Method 1: Remote curl or wget on server
                var dlCmd = $"mkdir -p '{pluginsDir}' && (curl -fSL -A '{ModrinthUserAgent}' -o '{targetFile}' '{request.DownloadUrl}' || wget -q --user-agent='{ModrinthUserAgent}' -O '{targetFile}' '{request.DownloadUrl}')";
                var (exitCode, _, stdErr) = await _sshService.ExecuteCommandAsync(node, dlCmd, 60);

                if (exitCode == 0)
                {
                    affected.Add(node.Name);
                    continue;
                }

                // Method 2: Fallback download via backend and SFTP upload
                _logger.LogInformation("Remote curl failed on {Host}, falling back to SFTP binary upload: {StdErr}", node.Host, stdErr);
                if (cachedFileBytes == null)
                {
                    using var req = new HttpRequestMessage(HttpMethod.Get, request.DownloadUrl);
                    req.Headers.Add("User-Agent", ModrinthUserAgent);
                    var res = await _httpClient.SendAsync(req);
                    res.EnsureSuccessStatusCode();
                    cachedFileBytes = await res.Content.ReadAsByteArrayAsync();
                }

                await _sshService.UploadBinaryFileAsync(node, targetFile, cachedFileBytes);
                affected.Add(node.Name);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to install plugin on node {Node}", node.Name);
                errors.Add($"{node.Name}: {ex.Message}");
            }
        }

        if (errors.Count > 0 && affected.Count == 0)
        {
            return new PluginOperationResult
            {
                Success = false,
                Message = $"Installation fehlgeschlagen: {string.Join("; ", errors)}",
                AffectedNodes = affected
            };
        }

        return new PluginOperationResult
        {
            Success = true,
            Message = $"Plugin '{safeFileName}' erfolgreich installiert auf: {string.Join(", ", affected)}" + (errors.Count > 0 ? $" (Fehler bei: {string.Join(", ", errors)})" : ""),
            AffectedNodes = affected
        };
    }

    public async Task<PluginOperationResult> TogglePluginAsync(TogglePluginRequest request)
    {
        var node = await _clusterService.GetNodeAsync(request.NodeId);
        if (node == null) return new PluginOperationResult { Success = false, Message = "Server nicht gefunden." };

        var pluginsDir = $"{node.RemoteDirectory.TrimEnd('/')}/plugins";
        string oldPath;
        string newPath;

        if (request.Enable)
        {
            // Enable: remove .disabled suffix
            if (!request.FileName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
            {
                return new PluginOperationResult { Success = true, Message = "Plugin ist bereits aktiviert." };
            }
            oldPath = $"{pluginsDir}/{request.FileName}";
            newPath = $"{pluginsDir}/{request.FileName[..^9]}"; // remove .disabled
        }
        else
        {
            // Disable: append .disabled suffix
            if (request.FileName.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
            {
                return new PluginOperationResult { Success = true, Message = "Plugin ist bereits deaktiviert." };
            }
            oldPath = $"{pluginsDir}/{request.FileName}";
            newPath = $"{pluginsDir}/{request.FileName}.disabled";
        }

        var mvCmd = $"mv '{oldPath}' '{newPath}'";
        var (exitCode, _, stdErr) = await _sshService.ExecuteCommandAsync(node, mvCmd, 15);

        if (exitCode != 0)
        {
            return new PluginOperationResult { Success = false, Message = $"Fehler beim Umschalten: {stdErr}" };
        }

        return new PluginOperationResult
        {
            Success = true,
            Message = request.Enable 
                ? $"Plugin auf '{node.Name}' aktiviert. Neustart erforderlich." 
                : $"Plugin auf '{node.Name}' deaktiviert. Neustart erforderlich.",
            AffectedNodes = new List<string> { node.Name }
        };
    }

    public async Task<PluginOperationResult> DeletePluginAsync(string nodeId, string fileName)
    {
        var node = await _clusterService.GetNodeAsync(nodeId);
        if (node == null) return new PluginOperationResult { Success = false, Message = "Server nicht gefunden." };

        var pluginsDir = $"{node.RemoteDirectory.TrimEnd('/')}/plugins";
        var targetFile = $"{pluginsDir}/{fileName}";

        var rmCmd = $"rm -f '{targetFile}'";
        var (exitCode, _, stdErr) = await _sshService.ExecuteCommandAsync(node, rmCmd, 15);

        if (exitCode != 0)
        {
            return new PluginOperationResult { Success = false, Message = $"Fehler beim Löschen: {stdErr}" };
        }

        return new PluginOperationResult
        {
            Success = true,
            Message = $"Plugin '{fileName}' von '{node.Name}' gelöscht.",
            AffectedNodes = new List<string> { node.Name }
        };
    }

    private static string CleanPluginName(string fileName)
    {
        var name = fileName;
        if (name.EndsWith(".disabled", StringComparison.OrdinalIgnoreCase))
        {
            name = name[..^9];
        }
        if (name.EndsWith(".jar", StringComparison.OrdinalIgnoreCase))
        {
            name = name[..^4];
        }
        return name;
    }

    private static string FormatFileSize(long bytes)
    {
        if (bytes <= 0) return "0 B";
        string[] units = { "B", "KB", "MB", "GB" };
        var order = 0;
        double size = bytes;
        while (size >= 1024 && order < units.Length - 1)
        {
            order++;
            size /= 1024;
        }
        return $"{size:0.##} {units[order]}";
    }
}
