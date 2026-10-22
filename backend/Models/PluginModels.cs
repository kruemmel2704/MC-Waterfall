using System.Text.Json.Serialization;

namespace McWaterfall.Backend.Models;

public class ModrinthSearchResponse
{
    [JsonPropertyName("hits")]
    public List<ModrinthSearchHit> Hits { get; set; } = new();

    [JsonPropertyName("offset")]
    public int Offset { get; set; }

    [JsonPropertyName("limit")]
    public int Limit { get; set; }

    [JsonPropertyName("total_hits")]
    public int TotalHits { get; set; }
}

public class ModrinthSearchHit
{
    [JsonPropertyName("project_id")]
    public string ProjectId { get; set; } = string.Empty;

    [JsonPropertyName("project_type")]
    public string ProjectType { get; set; } = string.Empty;

    [JsonPropertyName("slug")]
    public string Slug { get; set; } = string.Empty;

    [JsonPropertyName("author")]
    public string Author { get; set; } = string.Empty;

    [JsonPropertyName("title")]
    public string Title { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("categories")]
    public List<string> Categories { get; set; } = new();

    [JsonPropertyName("display_categories")]
    public List<string> DisplayCategories { get; set; } = new();

    [JsonPropertyName("versions")]
    public List<string> Versions { get; set; } = new();

    [JsonPropertyName("downloads")]
    public int Downloads { get; set; }

    [JsonPropertyName("follows")]
    public int Follows { get; set; }

    [JsonPropertyName("icon_url")]
    public string? IconUrl { get; set; }

    [JsonPropertyName("latest_version")]
    public string? LatestVersion { get; set; }

    [JsonPropertyName("date_modified")]
    public DateTime? DateModified { get; set; }
}

public class ModrinthVersion
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("project_id")]
    public string ProjectId { get; set; } = string.Empty;

    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("version_number")]
    public string VersionNumber { get; set; } = string.Empty;

    [JsonPropertyName("game_versions")]
    public List<string> GameVersions { get; set; } = new();

    [JsonPropertyName("loaders")]
    public List<string> Loaders { get; set; } = new();

    [JsonPropertyName("files")]
    public List<ModrinthVersionFile> Files { get; set; } = new();

    [JsonPropertyName("date_published")]
    public DateTime? DatePublished { get; set; }
}

public class ModrinthVersionFile
{
    [JsonPropertyName("id")]
    public string? Id { get; set; }

    [JsonPropertyName("url")]
    public string Url { get; set; } = string.Empty;

    [JsonPropertyName("filename")]
    public string Filename { get; set; } = string.Empty;

    [JsonPropertyName("primary")]
    public bool Primary { get; set; }

    [JsonPropertyName("size")]
    public long Size { get; set; }
}

public class InstalledPlugin
{
    public string FileName { get; set; } = string.Empty;
    public string PluginName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public string SizeFormatted { get; set; } = string.Empty;
    public bool IsEnabled { get; set; } = true;
    public DateTime? LastModified { get; set; }
}

public class InstallPluginRequest
{
    public string NodeId { get; set; } = string.Empty; // specific nodeId or "all_paper" or "all"
    public string DownloadUrl { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string? PluginName { get; set; }
}

public class TogglePluginRequest
{
    public string NodeId { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public bool Enable { get; set; }
}

public class PluginOperationResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public List<string> AffectedNodes { get; set; } = new();
}
