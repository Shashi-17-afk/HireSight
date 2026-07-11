import { DurableObject } from "cloudflare:workers";

/**
 * CandidateStatusDO — one instance per candidate (keyed by user_id).
 * Maintains WebSocket connections from the candidate's open browser tabs and
 * pushes status-change notifications from the HR applications route.
 * Uses the Hibernation API (same pattern as LeaderboardDO) so idle connections
 * don't keep the DO alive.
 */
export class CandidateStatusDO extends DurableObject<Env> {
	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);

		// ── WebSocket upgrade — candidate's browser connects here ────────────
		if (request.headers.get("Upgrade") === "websocket") {
			const pair = new WebSocketPair();
			const [client, server] = Object.values(pair);
			this.ctx.acceptWebSocket(server);
			server.send(JSON.stringify({ type: "connected" }));
			return new Response(null, { status: 101, webSocket: client });
		}

		// ── Internal POST /notify — called by the applications route ─────────
		if (url.pathname.endsWith("/notify") && request.method === "POST") {
			const payload = (await request.json()) as {
				application_id: string;
				job_id: string;
				job_title: string;
				from_status: string;
				to_status: string;
			};

			const message = JSON.stringify({ type: "status_update", ...payload });

			let notified = 0;
			for (const ws of this.ctx.getWebSockets()) {
				try {
					ws.send(message);
					notified++;
				} catch {
					// Client disconnected — hibernation will clean up
				}
			}

			return Response.json({ ok: true, notified });
		}

		return new Response("Not Found", { status: 404 });
	}

	// Hibernation API — called when the candidate sends a message over the socket.
	// Candidates only receive, but handle a ping gracefully.
	webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
		try {
			const data = JSON.parse(String(message)) as { type?: string };
			if (data.type === "ping") ws.send(JSON.stringify({ type: "pong" }));
		} catch {
			// Ignore malformed messages
		}
	}

	webSocketClose(): void {}
}
