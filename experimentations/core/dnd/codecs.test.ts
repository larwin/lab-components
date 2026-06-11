import { describe, expect, it } from 'vitest';
import { NP6_DND_JSON_V1 } from './codecs';
import type { DragPayload } from './types';

function createPayload(): DragPayload {
  return {
    version: '1.0',
    headers: {
      contentType: 'grid/columns',
      source: 'grid.headers',
    },
    data: {
      items: [
        { id: 'name', type: 'grid.column', label: 'Name' },
        { id: 'role', type: 'grid.column' },
      ],
    },
  };
}

describe('NP6_DND_JSON_V1', () => {
  it('encodes a drag payload as JSON', () => {
    const payload = createPayload();

    expect(NP6_DND_JSON_V1.encode(payload)).toBe(JSON.stringify(payload));
  });

  it('decodes a valid drag payload', () => {
    const payload = createPayload();

    expect(NP6_DND_JSON_V1.decode(JSON.stringify(payload))).toEqual(payload);
  });

  it('rejects invalid JSON', () => {
    expect(NP6_DND_JSON_V1.decode('{bad-json')).toBeNull();
  });

  it('rejects payloads with an unsupported version', () => {
    const payload = {
      ...createPayload(),
      version: '2.0',
    };

    expect(NP6_DND_JSON_V1.decode(JSON.stringify(payload))).toBeNull();
  });

  it('rejects payloads without a content type header', () => {
    const payload = {
      version: '1.0',
      headers: {},
      data: { items: [] },
    };

    expect(NP6_DND_JSON_V1.decode(JSON.stringify(payload))).toBeNull();
  });

  it('rejects payloads without a valid items array', () => {
    const payload = {
      version: '1.0',
      headers: { contentType: 'grid/columns' },
      data: { items: [{ id: 'name' }] },
    };

    expect(NP6_DND_JSON_V1.decode(JSON.stringify(payload))).toBeNull();
  });
});
