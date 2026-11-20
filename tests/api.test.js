import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchFromSheet } from '../src/services/api';

describe('fetchFromSheet transport selection', () => {
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
    globalThis.fetch = originalFetch;
  });

  it('uses google.script.run.apiRequest when available and parses JSON response', async () => {
    const apiRequestMock = vi.fn();
    const runner = {
      withSuccessHandler(fn) {
        this._onSuccess = fn;
        return this;
      },
      withFailureHandler(fn) {
        this._onFailure = fn;
        return this;
      },
      apiRequest(action, payload) {
        apiRequestMock(action, payload);
        this._onSuccess(JSON.stringify({
          status: 'success',
          data: { status: 'batch_recorded', ids: ['u1'], transactions: [{ id: 'u1' }] }
        }));
      }
    };

    globalThis.window = { google: { script: { run: runner } } };
    globalThis.fetch = vi.fn();

    const res = await fetchFromSheet('BATCH_TRANSACTIONS', { transactions: [{ action: 'BORROW' }] });
    expect(apiRequestMock).toHaveBeenCalledWith('BATCH_TRANSACTIONS', { transactions: [{ action: 'BORROW' }] });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(res.data.ids).toEqual(['u1']);
  });

  it('propagates server errors and failure handler errors from google.script.run', async () => {
    const makeRunner = (trigger) => ({
      withSuccessHandler(fn) {
        this._onSuccess = fn;
        return this;
      },
      withFailureHandler(fn) {
        this._onFailure = fn;
        return this;
      },
      apiRequest() {
        trigger(this);
      }
    });

    globalThis.window = {
      google: {
        script: {
          run: makeRunner((ctx) => ctx._onSuccess(JSON.stringify({ status: 'error', message: 'Duplicate borrow' })))
        }
      }
    };
    await expect(fetchFromSheet('BORROW', {})).rejects.toThrow('Duplicate borrow');

    globalThis.window = {
      google: {
        script: {
          run: makeRunner((ctx) => ctx._onFailure(new Error('GAS RPC failed')))
        }
      }
    };
    await expect(fetchFromSheet('BORROW', {})).rejects.toThrow('GAS RPC failed');
  });

  it('falls back to fetch POST when google.script.run is unavailable', async () => {
    delete globalThis.window;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success', data: { tools: [] } })
    });

    const res = await fetchFromSheet('GET_ALL_DATA', {});
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const [, options] = globalThis.fetch.mock.calls[0];
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ action: 'GET_ALL_DATA' });
    expect(res.data.tools).toEqual([]);
  });
});
