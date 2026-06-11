import type { DragCodec, DragItem, DragPayload } from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isDragItem(value: unknown): value is DragItem {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' && typeof value.type === 'string';
}

function isDragPayload(value: unknown, version: string): value is DragPayload {
  if (!isRecord(value)) return false;
  if (value.version !== version) return false;

  if (!isRecord(value.headers)) return false;
  if (typeof value.headers.contentType !== 'string') return false;

  if (!isRecord(value.data)) return false;
  if (!Array.isArray(value.data.items)) return false;
  if (!value.data.items.every(isDragItem)) return false;

  return true;
}

export const NP6_DND_JSON_V1: DragCodec = {
  version: '1.0',
  encode: (payload) => JSON.stringify(payload),
  decode: (raw) => {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isDragPayload(parsed, '1.0') ? parsed : null;
    } catch {
      return null;
    }
  },
};
