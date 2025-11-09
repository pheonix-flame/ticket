// api/login.js (for Vercel/Netlify Serverless Functions)

// 1. Get the Apps Script URL from a secure Environment Variable
const APPS_SCRIPT_URL = process.env.GOOGLE_APPS_SCRIPT_URL;

// Ensure the environment variable is set
if (!APPS_SCRIPT_URL) {
    console.error("The GOOGLE_APPS_SCRIPT_URL environment variable is not set.");
}

/**
 * Handles the incoming request from the frontend and proxies it to Apps Script.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 */
export default async function (req, res) {
    // ⚠️ Security Check: Only allow POST method from client
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ success: false, error: "Method Not Allowed" });
    }

    if (!APPS_SCRIPT_URL) {
        return res.status(500).json({ success: false, error: "Server Configuration Error: Apps Script URL missing." });
    }

    try {
        // 2. Read the JSON body sent by the client (frontend)
        const clientRequestBody = await new Promise((resolve, reject) => {
            let body = '';
            req.on('data', chunk => {
                body += chunk.toString();
            });
            req.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error('Invalid JSON body'));
                }
            });
            req.on('error', reject);
        });

        const action = clientRequestBody.action;

        let appsScriptResponse;

        if (action === 'checkSubscription') {
            // SCENARIO 1: Handle Subscription Check (Proxied as Server-to-Server GET to Apps Script doGet)
            const username = clientRequestBody.username;
            if (!username) {
                 return res.status(400).json({ success: false, error: "Missing 'username' for subscription check." });
            }

            // Construct GET URL with parameters for Apps Script doGet
            const fullAppsScriptUrl = `${APPS_SCRIPT_URL}?action=${encodeURIComponent(action)}&username=${encodeURIComponent(username)}`;

            appsScriptResponse = await fetch(fullAppsScriptUrl, {
                method: 'GET', // Server-to-Server request must be GET for doGet
                headers: {
                    'Content-Type': 'application/json'
                }
            });

        } else {
            // SCENARIO 2: Handle Login/Logout (Proxied as POST to Apps Script doPost)
            appsScriptResponse = await fetch(APPS_SCRIPT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(clientRequestBody) // Forward original POST body
            });
        }

        // 4. Get the JSON result from Apps Script
        const result = await appsScriptResponse.json();

        // 5. Respond to the client (frontend) with the data
        res.status(200).json(result);

    } catch (error) {
        console.error('Proxy Error:', error.message);
        res.status(500).json({ 
            success: false, 
            error: `Internal Proxy Error: ${error.message}` 
        });
    }
}