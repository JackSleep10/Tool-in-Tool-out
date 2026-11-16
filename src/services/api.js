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
            // mode: 'no-cors' // Use 'cors' if simplified, but 'no-cors' is common for GAS
            // However, for reading data we usually want CORS to work or use JSONP.
            // Modern GAS Web Apps support CORS if returning TextOutput with proper headers.
        });
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        throw error;
    }
};
