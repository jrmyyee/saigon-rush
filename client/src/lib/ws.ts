import type { ClientRole, WSMessage } from "@shared/types";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

export function createWSClient(role: ClientRole, sessionId: string) {
  let ws: WebSocket | null = null;
  let handlers: Array<(msg: WSMessage) => void> = [];
  let closed = false;

  function connect() {
    ws = new WebSocket(`${WS_URL}/ws?session=${sessionId}&role=${role}`);
    ws.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data);
        handlers.forEach((h) => h(msg));
      } catch { /* ignore malformed */ }
    };
    ws.onclose = () => {
      if (!closed) setTimeout(connect, 1000);
    };
  }

  connect();

  return {
    send(msg: WSMessage) {
      if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    onMessage(handler: (msg: WSMessage) => void) {
      handlers.push(handler);
      return () => { handlers = handlers.filter((h) => h !== handler); };
    },
    close() {
      closed = true;
      ws?.close();
    },
    isConnected: () => ws?.readyState === WebSocket.OPEN,
  };
}
