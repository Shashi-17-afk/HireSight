import { DurableObject } from "cloudflare:workers";

export interface LeaderboardEntry {
  id: string;
  name: string;
  score: number;
  reasoning: string;
}

export class LeaderboardDO extends DurableObject<Env> {
  private entries: LeaderboardEntry[] = [];

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get("Upgrade") === "websocket") {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      this.ctx.acceptWebSocket(server);
      server.send(JSON.stringify({ type: "leaderboard", entries: this.entries }));

      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/update" && request.method === "POST") {
      const entry = (await request.json()) as LeaderboardEntry;
      this.entries.push(entry);
      this.entries.sort((a, b) => b.score - a.score);

      for (const ws of this.ctx.getWebSockets()) {
        ws.send(JSON.stringify({ type: "leaderboard", entries: this.entries }));
      }

      return Response.json({ ok: true });
    }

    return new Response("Not Found", { status: 404 });
  }
}
