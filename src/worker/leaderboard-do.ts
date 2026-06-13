import { DurableObject } from "cloudflare:workers";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  reasoning: string;
  submittedAt: number; // ms epoch — used as tiebreaker (earlier = higher rank)
}

export class LeaderboardDO extends DurableObject<Env> {
  private entries: LeaderboardEntry[] = [];
  private initialized = false;

  // Load persisted entries from DO storage on first use
  private async ensureLoaded(): Promise<void> {
    if (this.initialized) return;
    const stored = await this.ctx.storage.get<LeaderboardEntry[]>("entries");
    this.entries = stored ?? [];
    this.initialized = true;
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();

    const url = new URL(request.url);

    // WebSocket upgrade — frontend leaderboard viewer
    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      // Hibernation API: DO can sleep between messages without losing WS connections
      this.ctx.acceptWebSocket(server);

      // Send current leaderboard snapshot immediately on connect
      server.send(
        JSON.stringify({ type: "leaderboard", entries: this.entries })
      );

      return new Response(null, { status: 101, webSocket: client });
    }

    // Internal update from candidate scoring endpoint
    if (url.pathname.endsWith("/update") && request.method === "POST") {
      const entry = (await request.json()) as LeaderboardEntry;

      // Replace existing entry if candidate re-submitted, preserve original submittedAt
      const existingIdx = this.entries.findIndex((e) => e.id === entry.id);
      if (existingIdx >= 0) {
        this.entries[existingIdx] = {
          ...entry,
          submittedAt: this.entries[existingIdx].submittedAt, // keep original time
        };
      } else {
        this.entries.push({ ...entry, submittedAt: entry.submittedAt ?? Date.now() });
      }

      // Sort: score descending; ties broken by submission time ascending (earlier = higher rank)
      this.entries.sort((a, b) => b.score - a.score || a.submittedAt - b.submittedAt);

      // Persist to DO storage so leaderboard survives restarts
      await this.ctx.storage.put("entries", this.entries);

      // Broadcast updated leaderboard to all connected WebSocket clients
      const message = JSON.stringify({
        type: "leaderboard",
        entries: this.entries,
      });

      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(message);
        } catch {
          // Client already disconnected — ignore
        }
      }

      return Response.json({ ok: true, total: this.entries.length });
    }

    // Snapshot endpoint — REST fallback for non-WS clients
    if (url.pathname.endsWith("/snapshot") && request.method === "GET") {
      return Response.json({ entries: this.entries });
    }

    return new Response("Not Found", { status: 404 });
  }

  // Hibernation API handlers — called by the runtime when messages arrive
  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    // Clients can send a "ping" to request a fresh snapshot
    try {
      const data = JSON.parse(String(message)) as { type?: string };
      if (data.type === "ping") {
        ws.send(
          JSON.stringify({ type: "leaderboard", entries: this.entries })
        );
      }
    } catch {
      // Ignore malformed messages
    }
  }

  webSocketClose(
    _ws: WebSocket,
    _code: number,
    _reason: string,
    _wasClean: boolean
  ): void {
    // Nothing to clean up — hibernation handles the rest
  }
}
