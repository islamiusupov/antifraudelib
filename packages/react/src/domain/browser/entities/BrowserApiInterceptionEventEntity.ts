export type BrowserApiInterceptionEventEntity = {
  kind: 'media_requested' | 'fetch_requested' | 'xhr_requested' | 'clipboard_read' | 'clipboard_write';
  atMs: number;
  allowed: boolean;
  metadata: Record<string, unknown>;
};
