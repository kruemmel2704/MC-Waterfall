# Build Stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["McWaterfall.Backend.csproj", "./"]
RUN dotnet restore "McWaterfall.Backend.csproj"

COPY . .
RUN dotnet publish "McWaterfall.Backend.csproj" -c Release -o /app/publish

# Runtime Stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

ENV ASPNETCORE_URLS=http://+:5005
EXPOSE 5005

ENTRYPOINT ["dotnet", "McWaterfall.Backend.dll"]
