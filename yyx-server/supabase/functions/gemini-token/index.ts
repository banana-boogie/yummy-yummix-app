import { validateAuth } from "../_shared/auth.ts";

const GEMINI_URL = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

console.log("Gemini Proxy (Modern Deno/v1beta) booting...");

Deno.serve(async (req) => {
    try {
        // 1. WebSocket Upgrade Check
        if (req.headers.get("upgrade") != "websocket") {
            return new Response("Expected WebSocket Upgrade", { status: 426 });
        }

        // 2. Auth (Query Param 'jwt')
        const url = new URL(req.url);
        const jwt = url.searchParams.get("jwt");
        if (!jwt) {
            console.error("[Proxy] Missing JWT");
            return new Response("Missing JWT", { status: 401 });
        }

        const { user, error } = await validateAuth(`Bearer ${jwt}`);
        if (error || !user) {
            console.error("[Proxy] Auth failed:", error);
            return new Response("Unauthorized", { status: 401 });
        }

        console.log(`[Proxy] Connecting user: ${user.id}`);

        // 3. Upgrade & Connect
        // Deno.upgradeWebSocket now returns { socket, response }
        const { socket: clientWs, response } = Deno.upgradeWebSocket(req);
        const apiKey = Deno.env.get("GEMINI_API_KEY");

        if (!apiKey) {
            console.error("[Proxy] No API Key set");
            // We can't return Response here because upgrade happened. 
            // We must close the socket.
            clientWs.onopen = () => clientWs.close(1011, "Server Config Error");
            return response;
        }

        console.log(`[Proxy] Dialing Google: ${GEMINI_URL}`);
        const upstreamWs = new WebSocket(`${GEMINI_URL}?key=${apiKey}`);

        // 4. Pipe Events
        clientWs.onopen = () => console.log("[Proxy] Client Open");

        upstreamWs.onopen = () => {
            console.log("[Proxy] Upstream (Google) Open");
        };

        clientWs.onmessage = (e) => {
            if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.send(e.data);
        };

        upstreamWs.onmessage = (e) => {
            if (clientWs.readyState === WebSocket.OPEN) clientWs.send(e.data);
        };

        upstreamWs.onerror = (e) => {
            // e is Event, not Error usually, so JSON stringify might be empty
            console.error("[Proxy] Upstream Error Event");
        };

        clientWs.onerror = (e) => {
            console.error("[Proxy] Client Error Event");
        };

        clientWs.onclose = () => {
            console.log("[Proxy] Client Closed");
            if (upstreamWs.readyState === WebSocket.OPEN) upstreamWs.close();
        };

        upstreamWs.onclose = (e) => {
            console.log(`[Proxy] Upstream Closed: ${e.code} ${e.reason}`);
            if (clientWs.readyState === WebSocket.OPEN) {
                clientWs.close(e.code || 1000, e.reason || "Upstream Closed");
            }
        };

        return response;

    } catch (err) {
        console.error("[Proxy] Critical Error:", err);
        return new Response("Internal Server Error", { status: 500 });
    }
});
