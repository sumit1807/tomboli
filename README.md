# Tomboli v0.5 — Local real-time multiplayer

## What's new
- Remote rooms use WebSocket (STOMP over `/ws`) for immediate room updates; the frontend no longer polls every 1.5 seconds.
- Room state is persisted in a local, file-backed H2 database (`backend/data/tomboli`). Rooms, player tokens, tickets, called-number order, status and prize winners are restored when the backend restarts.
- Browser room session is retained in local storage so a player can refresh and reconnect to their room.
- REST remains the command channel; only the host token can start, pause, reset or call numbers. The server validates prize claims and persists accepted winners.

## Requirements
- Java 17+
- Maven 3.9+
- Node.js 20.19+ or 22.12+

## Run locally (same computer)
Terminal 1:
```bash
cd backend
mvn spring-boot:run
```
Terminal 2:
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173.

## Test with other devices on the same Wi-Fi/LAN
1. Find the host computer's private IPv4 address (Windows: run `ipconfig`, then use the IPv4 Address).
2. Start the backend and Vite as above. Vite is configured with `--host 0.0.0.0` so it listens on the LAN interface.
3. Allow inbound connections to TCP ports 5173 and 8080 in the host computer firewall if prompted. The frontend proxies API and WebSocket traffic to the backend.
4. On each other device connected to the same Wi-Fi, open `http://HOST-LAN-IP:5173` (replace `HOST-LAN-IP` with the host computer's IPv4 address).
5. The host creates a Remote Room and shares the six-character room code. Other players select Join Room.

For this local test, devices must be on the same reachable LAN. Do not expose ports to the public internet; cloud deployment and production security are a later step.

## Persistence
H2 uses `backend/data/tomboli.mv.db`. Keep the `backend/data` folder to retain rooms between restarts. Back it up before upgrades. Deleting this file deletes saved rooms. The in-memory WebSocket broker is suitable for this single-server local test; it is not a multi-instance cloud broker.

## Notes
- A room's saved player session token is stored in the local browser and in the local H2 database. Treat the host computer and browser profile as trusted during local testing.
- A disconnected player can refresh the page and reconnect using the retained browser session. If browser storage is cleared, the player must join again with the room code.
- Local multiplayer currently has no user accounts, TLS, public invite links, or multi-server clustering; those belong in the cloud deployment phase.
