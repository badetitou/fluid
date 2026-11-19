import { z } from 'zod';

/** MCP Apps protocol version this viewer speaks. */
export const PROTOCOL_VERSION = '2026-01-26';

const messageSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string().optional(),
  params: z.unknown().optional(),
  result: z.unknown().optional(),
  error: z.object({ message: z.string().optional() }).optional(),
});
type Message = z.infer<typeof messageSchema>;

const hostContextSchema = z.object({ theme: z.enum(['light', 'dark']).optional() });
export type HostContext = z.infer<typeof hostContextSchema>;

export interface BridgeHandlers {
  onToolResult: (params: unknown) => void;
  onHostContext: (context: HostContext) => void;
}

/** The parent frame: the only thing the bridge talks to. */
export interface HostPort {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
}

/**
 * Minimal MCP Apps client (JSON-RPC over postMessage): handshake, host notifications, and requests
 * to the host. Only messages whose source is the parent frame are read, and every one is validated.
 */
export class HostBridge {
  private nextId = 1;
  private readonly pending = new Map<string | number, Pending>();

  constructor(
    private readonly host: HostPort,
    private readonly handlers: BridgeHandlers,
  ) {}

  /** Feed with every `message` event of the window. */
  handle(event: { source: unknown; data: unknown }): void {
    if (event.source !== this.host) return;
    const parsed = messageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.method === undefined) this.settle(msg);
    else if (msg.id !== undefined) this.answerRequest(msg.id, msg.method);
    else this.notified(msg.method, msg.params);
  }

  private settle(msg: Message): void {
    if (msg.id === undefined) return;
    const waiting = this.pending.get(msg.id);
    if (!waiting) return;
    this.pending.delete(msg.id);
    if (msg.error) waiting.reject(new Error(msg.error.message ?? 'The host refused the request.'));
    else waiting.resolve(msg.result);
  }

  private answerRequest(id: string | number, method: string): void {
    // `ping` and the teardown have nothing to give back; anything else is unknown to this view.
    if (method === 'ping' || method === 'ui/resource-teardown') this.send({ id, result: {} });
    else this.send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }

  private notified(method: string, params: unknown): void {
    if (method === 'ui/notifications/tool-result') this.handlers.onToolResult(params);
    else if (method === 'ui/notifications/host-context-changed') this.context(params);
  }

  private context(raw: unknown): void {
    const parsed = hostContextSchema.safeParse(raw);
    if (parsed.success) this.handlers.onHostContext(parsed.data);
  }

  private send(message: Record<string, unknown>): void {
    this.host.postMessage({ jsonrpc: '2.0', ...message }, '*');
  }

  request(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.send({ id, method, params });
    });
  }

  notify(method: string, params?: unknown): void {
    this.send({ method, params });
  }

  /** `ui/initialize` then `ui/notifications/initialized`; the host context of the answer is applied. */
  async connect(appInfo: { name: string; version: string }): Promise<void> {
    const result = await this.request('ui/initialize', {
      appInfo,
      appCapabilities: {},
      protocolVersion: PROTOCOL_VERSION,
    });
    const answer = z.object({ hostContext: z.unknown().optional() }).safeParse(result);
    if (answer.success) this.context(answer.data.hostContext);
    this.notify('ui/notifications/initialized');
  }

  /** `tools/call` on the host, which forwards it to the MCP server. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.request('tools/call', { name, arguments: args });
  }

  reportSize(size: { width: number; height: number }): void {
    this.notify('ui/notifications/size-changed', size);
  }
}
