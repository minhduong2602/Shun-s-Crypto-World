import { afterEach, describe, expect, it, vi } from 'vitest';
import { connectWithReconnect } from '@/lib/market/reconnecting-websocket';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close = vi.fn(() => this.onclose?.({} as CloseEvent));

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  open() { this.onopen?.({} as Event); }
  fail() { this.onerror?.({} as Event); this.onclose?.({} as CloseEvent); }
}

describe('connectWithReconnect', () => {
  afterEach(() => {
    vi.useRealTimers();
    FakeWebSocket.instances = [];
  });

  it('reconnects after a dropped socket with a capped exponential delay', () => {
    vi.useFakeTimers();
    const status = vi.fn();
    const connection = connectWithReconnect('wss://example.test/feed', {
      createSocket: (url) => new FakeWebSocket(url) as unknown as WebSocket,
      onStatus: status,
      baseDelayMs: 100,
      maxDelayMs: 250,
    });

    expect(FakeWebSocket.instances).toHaveLength(1);
    FakeWebSocket.instances[0].fail();
    expect(status).toHaveBeenLastCalledWith('FALLBACK_REST');
    vi.advanceTimersByTime(99);
    expect(FakeWebSocket.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(2);

    FakeWebSocket.instances[1].fail();
    vi.advanceTimersByTime(200);
    expect(FakeWebSocket.instances).toHaveLength(3);
    FakeWebSocket.instances[2].fail();
    vi.advanceTimersByTime(250);
    expect(FakeWebSocket.instances).toHaveLength(4);
    connection.close();
  });

  it('does not reconnect after cleanup and closes the active socket', () => {
    vi.useFakeTimers();
    const connection = connectWithReconnect('wss://example.test/feed', {
      createSocket: (url) => new FakeWebSocket(url) as unknown as WebSocket,
      onStatus: vi.fn(),
      baseDelayMs: 100,
      maxDelayMs: 500,
    });
    FakeWebSocket.instances[0].fail();
    connection.close();
    vi.advanceTimersByTime(1_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(FakeWebSocket.instances[0].close).toHaveBeenCalledOnce();
  });
});
