// ==========================================
// CONFIGURATION: CHANGE THESE 3 VARIABLES!
// ==========================================
const GH_OWNER = "YOUR_GITHUB_USERNAME"; 
const GH_REPO = "YOUR_REPO_NAME"; 
// This PAT is SAFE to expose if it ONLY has "Actions: Read & Write" and NO content access.
const GH_PAT = "github_pat_11XXXXXX_YYYYYYY"; 

const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml'
};

const getResponseUrl = (requestId) => `https://${GH_OWNER}.github.io/${GH_REPO}/api/responses/${requestId}.json`;
const getPollsUrl = () => `https://${GH_OWNER}.github.io/${GH_REPO}/api/public_polls.json`;
const generateUUID = () => crypto.randomUUID();

// 1. Send Request to GitHub Actions
async function dispatchAction(actionType, payload) {
    const requestId = generateUUID();
    const fullPayload = { ...payload, requestId, actionType };
    const workflowFile = workflows[actionType];

    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GH_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: "main",
            inputs: { payload: JSON.stringify(fullPayload) }
        })
    });

    if (!res.ok) throw new Error("Failed to wake up backend. Check your GH_PAT.");
    return await pollForResponse(requestId);
}

// 2. Wait for GitHub Actions to process and create the file
async function pollForResponse(requestId) {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 30) { // 60 seconds timeout
                clearInterval(interval);
                reject("Request timed out. GitHub Actions might be queued.");
            }
            try {
                // Cache-busting to get the absolute newest file
                const res = await fetch(`${getResponseUrl(requestId)}?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    clearInterval(interval);
                    if (data.status === 200) resolve(data);
                    else reject(data.error);
                }
            } catch (e) { /* File not ready, keep waiting */ }
        }, 2000); // Check every 2 seconds
    });
}
