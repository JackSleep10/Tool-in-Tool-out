// This service handles communication with Google Apps Script.
// Uses google.script.run directly when running inside Apps Script HtmlService
// (avoids the 302 redirect from /exec -> googleusercontent.com) and falls back
// to fetch() during local development (npm run dev).

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM/exec';

export const hasGasBridge = () =>
    typeof window !== 'undefined' &&
    Boolean(window.google && window.google.script && window.google.script.run);

const nowMs = () => (typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now());

const callViaGasBridge = (action, payload) => new Promise((resolve, reject) => {
    try {
        window.google.script.run
            .withSuccessHandler((raw) => {
                try {
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    resolve(parsed);
                } catch (parseErr) {
                    reject(new Error('ไม่สามารถอ่านข้อมูลจากเซิร์ฟเวอร์ได้'));
                }
            })
            .withFailureHandler((err) => {
                reject(new Error(err?.message || String(err || 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์')));
            })
            .runApiAction(JSON.stringify({ action, ...payload }));
    } catch (err) {
        reject(err);
    }
});

const callViaFetch = async (action, payload) => {
    // Mock behavior if no URL is configured (or matches placeholder)
    if (GOOGLE_SCRIPT_URL === 'YOUR_WEB_APP_URL_HERE' || GOOGLE_SCRIPT_URL === '') {
        console.warn('API URL not configured. Using Mock Data.');
        return null;
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        body: JSON.stringify({ action, ...payload }),
    });

    if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
    }

    return response.json();
};

export const fetchFromSheet = async (action, payload = {}) => {
    const start = nowMs();
    const transport = hasGasBridge() ? 'gas-bridge' : 'fetch';

    try {
        const result = transport === 'gas-bridge'
            ? await callViaGasBridge(action, payload)
            : await callViaFetch(action, payload);

        if (result === null && transport === 'fetch') {
            return null;
        }

        const elapsed = Math.round(nowMs() - start);
        if (result?.timing) {
            console.info(`[API] ${action} (${transport}) ${elapsed}ms`, result.timing);
        } else {
            console.info(`[API] ${action} (${transport}) ${elapsed}ms`);
        }

        if (!result || result.status !== 'success') {
            throw new Error(result?.message || 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
        }

        // Guard against legacy nested error shape { status: 'success', data: { status: 'error', message } }
        if (result.data && result.data.status === 'error') {
            throw new Error(result.data.message || 'ไม่สามารถดำเนินการได้');
        }

        return result;
    } catch (error) {
        const elapsed = Math.round(nowMs() - start);
        console.error(`[API Error] ${action} (${transport}) ${elapsed}ms:`, error);
        throw error;
    }
};
