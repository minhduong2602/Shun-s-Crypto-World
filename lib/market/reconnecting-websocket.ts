export type WebSocketConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'FALLBACK_REST';

interface ReconnectingWebSocketOptions {
  createSocket?: (url: string) => WebSocket;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onStatus?: (status: WebSocketConnectionStatus) => void;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export function connectWithReconnect(url: string, options: ReconnectingWebSocketOptions) {
  const createSocket = options.createSocket ?? ((socketUrl: string) => new WebSocket(socketUrl));
  const baseDelayMs = Math.max(1, options.baseDelayMs ?? 1_000);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 30_000);
  let socket: WebSocket | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let retryAttempt = 0;
  let stopped = false;

  const scheduleReconnect = () => {
    if (stopped || retryTimer) return;
    options.onStatus?.('FALLBACK_REST');
    const delay = Math.min(baseDelayMs * 2 ** retryAttempt, maxDelayMs);
    retryAttempt += 1;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped) return;
    try {
      socket = createSocket(url);
      socket.onopen = (event) => {
        retryAttempt = 0;
        options.onStatus?.('CONNECTED');
        options.onOpen?.(event);
      };
      socket.onmessage = (event) => options.onMessage?.(event);
      socket.onerror = scheduleReconnect;
      socket.onclose = scheduleReconnect;
    } catch {
      scheduleReconnect();
    }
  };

  connect();

  return {
    close() {
      if (stopped) return;
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      const activeSocket = socket;
      socket = null;
      if (activeSocket && activeSocket.readyState !== WebSocket.CLOSED) activeSocket.close();
      options.onStatus?.('DISCONNECTED');
    },
  };
}
