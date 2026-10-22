using Microsoft.AspNetCore.Mvc;

namespace McWaterfall.Backend.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PortalGuideController : ControllerBase
{
    [HttpGet]
    public IActionResult GetPortalGuide()
    {
        var guide = new
        {
            title = "Nahtlose Dimensions-Verknüpfung im Waterfall-Cluster",
            overview = "Da Overworld, Nether und The End als eigenständige dedizierte Paper-Server laufen, benötigt der Cluster Plugins für die nahtlose Synchronisation von Portalen und Spieler-Inventaren.",
            steps = new[]
            {
                new
                {
                    title = "1. Inventar- & Spielerdaten-Synchronisation (HuskSync oder MySQL-PlayerDataBridge)",
                    description = "Damit Spieler ihre Rüstung, Items, XP, Gesundheit und Hunger nahtlos zwischen Overworld, Nether und End behalten, wird ein Sync-Plugin mit einer MySQL/MariaDB-Datenbank verbunden.",
                    recommendedPlugin = "HuskSync (Paper/Purpur)",
                    downloadUrl = "https://modrinth.com/plugin/husksync",
                    instructions = "HuskSync auf allen Backend-Servern (Lobby, Overworld, Nether, End) in den /plugins Ordner legen und dieselbe MySQL-Datenbank angeben."
                },
                new
                {
                    title = "2. Physische Dimensions-Portale (BungeePortals oder NetherPortals / AdvancedPortals)",
                    description = "Ermöglicht es Spielern, durch normale Nether- und Endportale zu laufen und automatisch auf den jeweiligen Dimensions-Server teleportiert zu werden.",
                    recommendedPlugin = "AdvancedPortals oder BungeePortals",
                    downloadUrl = "https://www.spigotmc.org/resources/advanced-portals.38761/",
                    instructions = "Erstelle ein Portal im Overworld: '/createportal nether_gate bungeecord:nether'. Sobald ein Spieler das Obsidian-Portal betritt, verbindet Waterfall ihn mit dem Nether-Server."
                },
                new
                {
                    title = "3. Direkte Befehlsweiterleitung (/server overworld, /server nether, /server end)",
                    description = "Über Waterfall können Spieler (falls Berechtigung 'bungeecord.command.server' vergeben ist) direkt zwischen den Servern wechseln.",
                    recommendedPlugin = "Waterfall integriert (Standardmäßig aktiviert)",
                    downloadUrl = "",
                    instructions = "In waterfall config.yml ist 'bungeecord.command.server' für die Gruppe default freigeschaltet. Spieler tippen einfach '/server nether' ein."
                },
                new
                {
                    title = "4. Firewall & Proxy-Schutz (IP-Whitelist)",
                    description = "Die Backend-Server sollten niemals direkt aus dem Internet erreichbar sein, sondern nur über den Waterfall-Proxy.",
                    recommendedPlugin = "UFW / BungeeGuard",
                    downloadUrl = "https://www.spigotmc.org/resources/bungeeguard.79601/",
                    instructions = "Auf den Backend-Nodes: 'sudo ufw allow from <PROXY_IP> to any port 25566:25570 proto tcp' und 'sudo ufw deny 25566:25570/tcp' ausführen."
                }
            }
        };

        return Ok(guide);
    }
}
