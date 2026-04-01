/**
 * CORE API CONFIGURATION
 * 
 * NOTE: The strings "YOUR_GITHUB_USERNAME", "YOUR_REPO_NAME", and "TOKEN_INJECTED_BY_ACTION" 
 * will be automatically replaced by the 'deploy.yml' GitHub Action 
 * using your repository secrets. Do not change them manually here.
 */
const GH_OWNER = "YOUR_GITHUB_USERNAME"; 
const GH_REPO = "YOUR_REPO_NAME"; 
const GH_PAT = "TOKEN_INJECTED_BY_ACTION"; 

// Maps frontend actions to their specific .yml backend files
const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml',
    'admin_create_poll': 'admin.yml',
    'admin_approve_user': 'admin.yml'
};

/**
 * UTILITY: Helper to build URLs for public data and action responses
 */
const getResponseUrl = (requestId) => `https://${GH_OWNER}.github.io/${GH_REPO}/api/responses/${requestId}.json`;
const getPollsUrl = () => `https://${GH_OWNER}.github.io/${GH_REPO}/api/public_polls.json`;
const generateUUID = () => crypto.randomUUID();

/**
 * MAIN FUNCTION: Sends a request to GitHub Actions (The Backend)
 * @param {string} actionType - One of the keys in the 'workflows' object
 * @param {object} payload - The data to send (credentials, vote info, etc.)
 */
async function dispatchAction(actionType, payload) {
    const requestId = generateUUID();
    
    // Add unique tracking ID and action type to the payload
    const fullPayload = { 
        ...payload, 
        requestId, 
        actionType,
        timestamp: new Date().toISOString()
    };
    
    const workflowFile = workflows[actionType];

    if (!workflowFile) {
        throw new Error(`No workflow mapped for action: ${actionType}`);
    }

    console.log(`🚀 Dispatching ${actionType} (ID: ${requestId})...`);

    // Trigger the GitHub Action via workflow_dispatch
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GH_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: "main", // Runs on the main branch
            inputs: {
                payload: JSON.stringify(fullPayload) // Passed as a string input to the YAML
            }
        })
    });

    if (!res.ok) {
        const errorDetails = await res.json().catch(() => ({}));
        console.error("GitHub API Error:", errorDetails);
        throw new Error("Failed to reach backend. The GitHub Token might be expired, or Actions are currently disabled.");
    }

    // Start polling for the result file that the Action will create
    return await pollForResponse(requestId);
}

/**
 * POLLING LOGIC: Checks GitHub Pages every 2 seconds for the result file
 * This bridges the gap because GitHub Actions are asynchronous.
 */
async function pollForResponse(requestId) {
    const maxAttempts = 40; // Max wait: ~80 seconds (GitHub Actions usually take 15-30s)
    let attempts = 0;

    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            attempts++;
            
            if (attempts > maxAttempts) {
                clearInterval(interval);
                reject("The backend is taking too long. Please refresh the page and check again in a moment.");
                return;
            }

            try {
                // Use a timestamp 't' to bypass browser cache and get the fresh file
                const response = await fetch(`${getResponseUrl(requestId)}?t=${Date.now()}`);
                
                if (response.ok) {
                    const resultData = await response.json();
                    clearInterval(interval);
                    
                    // Logic inside Action writes status 200 for success, 400 for errors
                    if (resultData.status === 200) {
                        console.log("✅ Action Resolved:", resultData);
                        resolve(resultData);
                    } else {
                        console.warn("⚠️ Action Failed:", resultData.error);
                        reject(resultData.error);
                    }
                } else {
                    console.log(`⏳ Waiting for response... (Attempt ${attempts}/${maxAttempts})`);
                }
            } catch (e) {
                // Fetch failed (file doesn't exist yet), continue polling
            }
        }, 2000); // Wait 2 seconds between checks
    });
}

/**
 * GLOBAL HELPER: Fetch current poll results directly from the static API
 */
async function fetchPollResults() {
    try {
        const res = await fetch(`${getPollsUrl()}?t=${Date.now()}`);
        if (!res.ok) return [];
        return await res.json();
    } catch (e) {
        console.error("Failed to load polls:", e);
        return [];
    }
}
