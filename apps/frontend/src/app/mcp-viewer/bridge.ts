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

const displayMode = z.enum(['inline', 'fullscreen', 'pip']);
export type DisplayMode = z.infer<typeof displayMode>;
const hostContextSchema = z.object({
  theme: z.enum(['light', 'dark']).optional().catch(undefined),
  displayMode: displayMode.optional().catch(undefined),
  availableDisplayModes: z.array(z.string()).optional().catch(undefined),
});
export type HostContext = z.infer<typeof hostContextSchema>;

export interface BridgeHandlers {
  onToolResult: (params: unknown) => void;
  /** `tool-input-partial` (while the model writes the arguments) and `tool-input` (complete). */
  onToolInput?: (params: unknown, partial: boolean) => void;
  onHostContext: (context: HostContext) => void;
}

/** The parent frame: the only thing the bridge talks to. */
export interface HostPort {
  postMessage: (message: unknown, targetOrigin: string) => void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** How long the host has to answer a request before it is given up. */
export const INITIALIZE_TIMEOUT_MS = 10_000;
export const TOOL_TIMEOUT_MS = 30_000;

/**
 * Minimal MCP Apps client (JSON-RPC over postMessage): handshake, host notifications, and requests
 * to the host. Only messages whose source is the parent frame are read, and every one is validated.
 */
export class HostBridge {
  private nextId = 1;
  private disposed = false;
  private readonly pending = new Map<string | number, Pending>();

  constructor(
    private readonly host: HostPort,
    private readonly handlers: BridgeHandlers,
  ) {}

  /** Feed with every `message` event of the window. */
  handle(event: { source: unknown; data: unknown }): void {
    if (this.disposed || event.source !== this.host) return;
    const parsed = messageSchema.safeParse(event.data);
    if (!parsed.success) return;
    const msg = parsed.data;
    if (msg.method === undefined) this.settle(msg);
    else if (msg.id !== undefined) this.answerRequest(msg.id, msg.method);
    else this.notified(msg.method, msg.params);
  }

  private settle(msg: Message): void {
    // A response carries a result or an error; an answer to an unknown or settled id is not ours.
    if (msg.id === undefined || (msg.error === undefined && !('result' in msg))) return;
    const waiting = this.pending.get(msg.id);
    if (!waiting) return;
    this.pending.delete(msg.id);
    clearTimeout(waiting.timer);
    if (msg.error) waiting.reject(new Error(msg.error.message ?? 'The host refused the request.'));
    else waiting.resolve(msg.result);
  }

  private answerRequest(id: string | number, method: string): void {
    // `ping` and the teardown have nothing to give back; anything else is unknown to this view.
    if (method === 'ui/resource-teardown') {
      this.send({ id, result: {} });
      this.dispose();
    } else if (method === 'ping') this.send({ id, result: {} });
    else this.send({ id, error: { code: -32601, message: `Method not found: ${method}` } });
  }

  private notified(method: string, params: unknown): void {
    if (method === 'ui/notifications/tool-result') this.handlers.onToolResult(params);
    else if (method === 'ui/notifications/tool-input-partial') this.handlers.onToolInput?.(params, true);
    else if (method === 'ui/notifications/tool-input') this.handlers.onToolInput?.(params, false);
    else if (method === 'ui/notifications/host-context-changed') this.context(params);
  }

  private context(raw: unknown): void {
    const parsed = hostContextSchema.safeParse(raw);
    if (!parsed.success) return;
    // A field the host got wrong is dropped; a context with nothing usable is not passed on.
    const known = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined)) as HostContext;
    if (Object.keys(known).length > 0) this.handlers.onHostContext(known);
  }

  private send(message: Record<string, unknown>): void {
    // Target origin '*': the host sits behind a sandbox proxy whose origin is opaque to the view, and
    // only the view's own requests (tool names, ids, row counts) are posted, never a secret.
    this.host.postMessage({ jsonrpc: '2.0', ...message }, '*');
  }

  request(method: string, params?: unknown, timeoutMs = TOOL_TIMEOUT_MS): Promise<unknown> {
    if (this.disposed) return Promise.reject(new Error('The host connection is closed.'));
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`The host did not answer ${method} in time.`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ id, method, params });
    });
  }

  /** Stops listening and rejects every request still waiting (teardown, unmount). */
  dispose(): void {
    this.disposed = true;
    for (const { reject, timer } of this.pending.values()) {
      clearTimeout(timer);
      reject(new Error('The host connection is closed.'));
    }
    this.pending.clear();
  }

  notify(method: string, params?: unknown): void {
    this.send({ method, params });
  }

  /** `ui/initialize` then `ui/notifications/initialized`; the host context of the answer is applied. */
  async connect(appInfo: { name: string; version: string }): Promise<void> {
    const result = await this.request(
      'ui/initialize',
      { appInfo, appCapabilities: {}, protocolVersion: PROTOCOL_VERSION },
      INITIALIZE_TIMEOUT_MS,
    );
    const answer = z.object({ hostContext: z.unknown().optional() }).safeParse(result);
    if (answer.success) this.context(answer.data.hostContext);
    this.notify('ui/notifications/initialized');
  }

  /** `tools/call` on the host, which forwards it to the MCP server. */
  callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    return this.request('tools/call', { name, arguments: args });
  }

  /** `ui/update-model-context`: what the model should know of the view at its next turn. */
  updateModelContext(params: { content: Array<{ type: 'text'; text: string }> }): Promise<unknown> {
    return this.request('ui/update-model-context', params);
  }

  /** `ui/message`: a message in the conversation, as the user. */
  sendMessage(params: { role: 'user'; content: Array<{ type: 'text'; text: string }> }): Promise<unknown> {
    return this.request('ui/message', params);
  }

  /** `ui/open-link`: the host opens the url (a new tab), after asking the user if it wants. */
  openLink(url: string): Promise<unknown> {
    return this.request('ui/open-link', { url });
  }

  /** `ui/request-display-mode`: answers the mode the host actually set. */
  async requestDisplayMode(mode: DisplayMode): Promise<DisplayMode | undefined> {
    const answer = z.object({ mode: displayMode }).safeParse(await this.request('ui/request-display-mode', { mode }));
    return answer.success ? answer.data.mode : undefined;
  }

  reportSize(size: { width: number; height: number }): void {
    this.notify('ui/notifications/size-changed', size);
  }
}
