using McWaterfall.Backend.Models;
using McWaterfall.Backend.Services;
using Microsoft.AspNetCore.Mvc;

namespace McWaterfall.Backend.Controllers;

public class DiscordLoginPayload
{
    public string Code { get; set; } = string.Empty;
    public string? RedirectUri { get; set; }
}

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(IAuthService authService, ILogger<AuthController> logger)
    {
        _authService = authService;
        _logger = logger;
    }

    [HttpGet("status")]
    public async Task<ActionResult<AuthStatusResponse>> GetStatus()
    {
        var token = ExtractToken();
        var status = await _authService.GetStatusAsync(token);
        return Ok(status);
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var result = await _authService.LoginAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("discord-login")]
    public async Task<ActionResult<LoginResponse>> DiscordLogin([FromBody] DiscordLoginPayload payload)
    {
        if (string.IsNullOrWhiteSpace(payload.Code))
        {
            return BadRequest(new LoginResponse { Success = false, Message = "OAuth2-Code fehlt." });
        }

        var result = await _authService.DiscordLoginAsync(payload.Code, payload.RedirectUri);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("setup")]
    public async Task<ActionResult<LoginResponse>> Setup([FromBody] SetupWizardRequest request)
    {
        var result = await _authService.SetupWizardAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    [HttpPost("logout")]
    public async Task<ActionResult> Logout()
    {
        var token = ExtractToken();
        if (!string.IsNullOrWhiteSpace(token))
        {
            await _authService.LogoutAsync(token);
        }
        return Ok(new { success = true, message = "Erfolgreich abgemeldet." });
    }

    [HttpGet("settings")]
    public async Task<ActionResult<SystemSettings>> GetSettings()
    {
        var settings = await _authService.GetSettingsAsync();
        // Mask sensitive hashes
        return Ok(new
        {
            settings.IsConfigured,
            settings.ServerName,
            settings.Architecture,
            settings.AdminUsername,
            settings.DiscordOAuthEnabled,
            settings.SetupCompletedAt
        });
    }

    [HttpPost("settings")]
    public async Task<ActionResult<PluginOperationResult>> UpdateSettings([FromBody] UpdateSettingsRequest request)
    {
        var result = await _authService.UpdateSettingsAsync(request);
        if (!result.Success)
        {
            return BadRequest(result);
        }
        return Ok(result);
    }

    private string? ExtractToken()
    {
        var authHeader = Request.Headers.Authorization.ToString();
        if (!string.IsNullOrWhiteSpace(authHeader) && authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
        {
            return authHeader["Bearer ".Length..].Trim();
        }

        if (Request.Headers.TryGetValue("X-Session-Token", out var headerToken))
        {
            return headerToken.ToString().Trim();
        }

        if (Request.Query.TryGetValue("token", out var queryToken))
        {
            return queryToken.ToString().Trim();
        }

        return null;
    }
}
