// --- Subscription Check Helper ---

// This endpoint proxies to your Google Apps Script backend via /api/login
const PROXY_ENDPOINT = '/api/login';

/**
 * Checks the user's subscription validity via backend.
 * Returns true if active, false if expired or inactive.
 * Used before creating, editing, or deleting tickets.
 */
async function hasValidSubscription() {
    const ownerKey = localStorage.getItem('ticketowner');

    if (!ownerKey) {
        alert('No active session found. Please log in again.');
        return false;
    }

    try {
        const response = await fetch(PROXY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'checkAndUpdateSubscription',
                username: ownerKey
            })
        });

        if (!response.ok) {
            console.error(`Subscription check failed (${response.status}).`);
            alert('Unable to verify subscription. Please try again later.');
            return false;
        }

        const result = await response.json();

        if (result.success && result.isActive === true) {
            console.log('Subscription active for', ownerKey);
            return true;
        } else {
            alert(result.message || 'Your subscription has expired or is inactive.');
            return false;
        }
    } catch (error) {
        console.error('Error during subscription check:', error);
        alert('Network error during subscription verification.');
        return false;
    }
}


window.addEventListener('DOMContentLoaded', () => {
    const ownerKey = localStorage.getItem('ticketowner');
    if (!ownerKey && !window.location.href.includes('index.html')) {
        alert('Your session has expired. Please log in again.');
        window.location.href = 'index.html';
    }
});
