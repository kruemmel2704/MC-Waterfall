using System.Text.Json.Serialization;
using McWaterfall.Backend.Hubs;
using McWaterfall.Backend.Services;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers with JSON String Enum conversion
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
    });

// Add SignalR for live log streaming and cluster notifications
builder.Services.AddSignalR();

// Swagger API Documentation
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// HTTP Client for downloading Paper & Waterfall releases
builder.Services.AddHttpClient();

// Core Services
builder.Services.AddSingleton<ISshService, SshService>();
builder.Services.AddSingleton<IMinecraftDeploymentService, MinecraftDeploymentService>();
builder.Services.AddSingleton<IClusterManagerService, ClusterManagerService>();
builder.Services.AddSingleton<IDiscordService, DiscordService>();

// CORS policy for React Frontend
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowReactApp", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// Enable Swagger in Development or local testing
app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "MC Waterfall Cluster API v1");
});

app.UseCors("AllowReactApp");

app.MapControllers();
app.MapHub<ClusterHub>("/hubs/cluster");

app.Run();
