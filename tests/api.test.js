import { describe, it, expect, afterEach, vi } from 'vitest';
import { fetchFromSheet, hasGasBridge } from '../src/services/api';

describe('src/services/api.js transport', () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.window = originalWindow;
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('uses google.script.run JSON bridge when available', async () => {
    let sentPayload = null;
    globalThis.window = {
      google: {
        script: {
          run: {
            withSuccessHandler(onSuccess) {
              this._onSuccess = onSuccess;
              return this;
            },
            withFailureHandler(onFailure) {
              this._onFailure = onFailure;
              return this;
            },
            runApiAction(raw) {
              sentPayload = JSON.parse(raw);
              this._onSuccess(JSON.stringify({
                status: 'success',
                data: { unchanged: true, data_version: '1:1:1' },
                timing: { total: 42 }
              }));
            }
          }
        }
      }
    };

    expect(hasGasBridge()).toBe(true);
    const res = await fetchFromSheet('GET_ALL_DATA', { client_version: '1:1:1' });
    expect(sentPayload).toEqual({ action: 'GET_ALL_DATA', client_version: '1:1:1' });
    expect(res.data.unchanged).toBe(true);
  });

  it('falls back to fetch when google.script.run is absent and throws on server error', async () => {
    globalThis.window = undefined;
    expect(hasGasBridge()).toBe(false);

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'error', message: 'Duplicate borrow' })
    });

    await expect(fetchFromSheet('BORROW', { tool_id: 'T-01' })).rejects.toThrow('Duplicate borrow');
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });
});
