# 🌐 Minecraft Waterfall Dimension Cluster Manager

Ein modernes Verwaltungs- und Bereitstellungstool für Minecraft-Server-Cluster mit **Waterfall Proxy** und separaten dedizierten Servern für alle Dimensionen (**Overworld**, **Nether**, **The End**, **Lobby**).

Entwickelt mit:
- **Frontend**: ReactJS (Vite, Glassmorphism Cyber-Theme, SignalR Real-Time Terminal, Lucide Icons)
- **Backend**: C# ASP.NET Core 8 / 10 Web API mit SSH.NET, SignalR WebSockets und automatisiertem Linux-Provisioning.

---

## 🚀 Schnellstart

### 1. Per Skript starten
Führe einfach die Datei `start-all.bat` mit einem Doppelklick aus.

### 2. Manuell starten
**Backend (C# ASP.NET Core):**
```bash
cd backend
dotnet run --urls "http://localhost:5005"
```

**Frontend (ReactJS):**
```bash
cd frontend
npm run dev
```

- **Web Dashboard:** [http://localhost:5173](http://localhost:5173)
- **Swagger API Docs:** [http://localhost:5005/swagger](http://localhost:5005/swagger)

---

## ⚡ Kernfunktionen

1. **Vollständige Dimensions-Architektur**:
   - **Waterfall Proxy** (Port 25565): Der öffentliche Einstiegspunkt für Spieler mit BungeeCord IP-Forwarding.
   - **Lobby / Hub** (Port 25566): Zentraler Treffpunkt und Spawn.
   - **Overworld Dimension** (Port 25567): Eigene PaperMC-Instanz für die Oberwelt.
   - **Nether Dimension** (Port 25568): Eigene PaperMC-Instanz für den Nether (`world_nether`).
   - **The End Dimension** (Port 25569): Eigene PaperMC-Instanz für das End (`world_the_end`).
   - **Beliebige Custom Server**: Zusätzliche Server (z.B. Farmwelt, Skyblock, Events) können mit 1 Klick hinzugefügt werden.

2. **SSH-Remote-Steuerung (Linux VPS / Dedicated Server)**:
   - Eingabe von **Host/IP**, **SSH-Port** (Standard 22), **Benutzername**, **Passwort** oder **SSH Private Key**.
   - **Live SSH-Test:** Überprüft sofort Verbindung, Linux-Distribution, installierte Java-Version, freien RAM und Festplattenspeicher.
   - Startet und überwacht Instanzen in Linux `screen`-Sessions (`mc_{nodeId}`).

3. **1-Klick Cluster-Bereitstellung (Automated Deployment)**:
   - Prüft & installiert auf Wunsch **OpenJDK 21** und `screen` via `apt` / `dnf`.
   - Lädt automatisch die neuesten stabilen Jars (Waterfall & PaperMC) herunter.
   - Akzeptiert die Minecraft `eula.txt`.
   - Schreibt `server.properties`, `spigot.yml` (`bungeecord: true`) und `config.yml`.
   - Erstellt `run.sh` und `stop.sh` Startskripte mit optimierten Aikar-JVM-Flags.

4. **Live-Konsole & Terminal (SignalR WebSockets)**:
   - Tabs für jeden Server im Cluster.
   - Live-Streaming der Server-Logs (`logs/latest.log` bzw. `proxy.log`).
   - Befehlseingabe mit Historie (Pfeiltasten oben/unten) und Schnellbefehlen (`/list`, `/tps`, `/whitelist`, `/greload`).

5. **Dimensions- & Portal-Guide**:
   - Integrierte Schritt-für-Schritt-Anleitung zur Synchronisation von Inventaren (z.B. **HuskSync**) und Verknüpfung physischer Nether-/End-Portale (z.B. **AdvancedPortals** / **BungeePortals**).
   - Firewall-Absicherung (UFW Regeln).

---

## 📁 Projektstruktur

```
MC Waterfall/
├── backend/
│   ├── Controllers/
│   │   ├── ClusterController.cs       # Server-Verwaltung, SSH-Tests & Status
│   │   ├── DeploymentController.cs    # Automatisierte Provisionierung
│   │   └── PortalGuideController.cs   # Guides & Config-Vorschau
│   ├── Hubs/
│   │   └── ClusterHub.cs              # SignalR WebSocket Hub für Terminal & Logs
│   ├── Models/
│   │   └── ClusterModels.cs           # Typen & Datenmodelle
│   ├── Services/
│   │   ├── SshService.cs              # SSH.NET Client & Befehlsausführung
│   │   ├── MinecraftDeploymentService.cs # Jar-Download & Config-Generierung
│   │   └── ClusterManagerService.cs   # JSON-Persistenz & Status-Polling
│   ├── Data/
│   │   └── cluster_config.json        # Gespeicherte Server- und Clusterdaten
│   └── Program.cs
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ClusterTopology.jsx    # Visuelles Netzwerk-Diagramm
│   │   │   ├── NodeCard.jsx           # Server-Kachel mit Live-Aktionen
│   │   │   ├── NodeEditModal.jsx      # Modal für IP, SSH & Port-Eingabe
│   │   │   ├── LiveConsole.jsx        # SignalR Terminal-Konsole
│   │   │   ├── ClusterDeployModal.jsx # Bereitstellungs-Assistent
│   │   │   └── PortalGuide.jsx        # Portal- & Dimensions-Dokumentation
│   │   ├── App.jsx                    # Haupt-Dashboard
│   │   └── index.css                  # Modernes Cyber-Dark Theme & Glassmorphism
│   └── vite.config.js                 # Proxy-Konfiguration zu Port 5005
└── start-all.bat                      # 1-Klick Starter
```
