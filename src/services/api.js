// This service will handle communication with Google Apps Script
// Once you have the Web App URL, replace it here.

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwFrI5N6LtVDguJgxs4hNjj7SZE4eg0_yikz11v2TGJqSJtG-ISQy1anJEOLMAYs8rM/exec';

export const fetchFromSheet = async (action, payload = {}) => {
    // Mock behavior if no URL is configured (or matches placeholder)
    if (GOOGLE_SCRIPT_URL === 'YOUR_WEB_APP_URL_HERE' || GOOGLE_SCRIPT_URL === '') {
        console.warn('API URL not configured. Using Mock Data.');
        return null;
    }

    try {
        const response = await fetch(GOOGLE_SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action, ...payload }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const result = await response.json();

        if (!result || result.status !== 'success') {
            throw new Error(result?.message || 'เกิดข้อผิดพลาดในการติดต่อเซิร์ฟเวอร์');
        }

        // Guard against legacy nested error shape { status: 'success', data: { status: 'error', message } }
        if (result.data && result.data.status === 'error') {
            throw new Error(result.data.message || 'ไม่สามารถดำเนินการได้');
        }

        return result;
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
