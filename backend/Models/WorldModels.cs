namespace McWaterfall.Backend.Models;

public class WorldDimensionInfo
{
    public string DimensionKey { get; set; } = string.Empty; // "overworld" | "nether" | "the_end" | "lobby"
    public string DimensionName { get; set; } = string.Empty;
    public string NodeId { get; set; } = string.Empty;
    public string WorldFolderName { get; set; } = string.Empty;
    public long SizeBytes { get; set; }
    public int RegionFileCount { get; set; }
    public bool Exists { get; set; }
    public DateTime? LastModified { get; set; }
}

public class WorldOverviewResponse
{
    public string ClusterName { get; set; } = string.Empty;
    public string Architecture { get; set; } = string.Empty;
    public List<WorldDimensionInfo> Dimensions { get; set; } = new();
    public long TotalSizeBytes { get; set; }
}

public class WorldImportResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string DetectedFormat { get; set; } = string.Empty;
    public int OverworldFiles { get; set; }
    public int NetherFiles { get; set; }
    public int EndFiles { get; set; }
    public int LobbyFiles { get; set; }
    public int TotalFiles { get; set; }
    public List<string> Details { get; set; } = new();
}

public class WorldResetRequest
{
    public List<string> Dimensions { get; set; } = new(); // ["overworld", "nether", "the_end", "lobby"] or ["all"]
    public string? CustomSeed { get; set; }
    public bool CreateBackupBeforeReset { get; set; } = true;
}

public class WorldResetResult
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public List<string> Details { get; set; } = new();
}
