import { WebWorkerMLCEngineHandler } from '@mlc-ai/web-llm';

// WebLLM runs inference off the main thread so the UI stays responsive while a
// model answers. Loaded only by browserEngine's lazy import.
const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg);
