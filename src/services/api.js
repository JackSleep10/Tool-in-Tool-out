// This service will handle communication with Google Apps Script
// Once you have the Web App URL, replace it here.

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM/exec';

const validateApiResult = (result) => {
    if (!result || result.status !== 'success') {
        throw new Error(result?.message || 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
    }

    // Guard against legacy nested error shape { status: 'success', data: { status: 'error', message } }
    if (result.data && result.data.status === 'error') {
        throw new Error(result.data.message || 'ไม่สามารถดำเนินการได้');
    }

    return result;
};

const canUseGasBridge = () =>
    typeof window !== 'undefined' &&
    typeof window.google?.script?.run?.apiRequest === 'function';

const callGasBridge = (action, payload) =>
    new Promise((resolve, reject) => {
        window.google.script.run
            .withSuccessHandler((raw) => {
                try {
                    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
                    resolve(parsed);
                } catch (parseErr) {
                    reject(parseErr);
                }
            })
            .withFailureHandler((err) => {
                const msg = err?.message || (typeof err === 'string' ? err : 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ได้');
                reject(new Error(msg));
            })
            .apiRequest(action, payload);
    });

export const fetchFromSheet = async (action, payload = {}) => {
    try {
        // Prefer direct google.script.run RPC when served from GAS HtmlService (avoids 302 redirect)
        if (canUseGasBridge()) {
            const result = await callGasBridge(action, payload);
            return validateApiResult(result);
        }

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

        const result = await response.json();
        return validateApiResult(result);
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
