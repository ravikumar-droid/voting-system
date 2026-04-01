// js/api.js
console.log("✅ api.js has loaded successfully!");

// 1. CONFIGURATION
const GH_OWNER = "ravikumar-droid"; 
const GH_REPO = "voting-system"; 
const GH_PAT = "PLACEHOLDER_TOKEN"; 
const GIST_ID = "PASTE_YOUR_GIST_ID_HERE"; // <--- PUT YOUR GIST ID HERE

const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml',
    'admin_create_poll': 'admin.yml',
    'admin_approve_user': 'admin.yml'
};

// 2. THE CORE FUNCTION
async function dispatchAction(actionType, payload) {
    console.log(`🚀 Attempting to dispatch: ${actionType}`);
    
    const requestId = crypto.randomUUID();
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

    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error("GH API Error:", errData);
        throw new Error("Backend connection failed. Status: " + res.status);
    }
    
    return await pollForResponse(requestId);
}

// 3. THE POLLING FUNCTION
async function pollForResponse(requestId) {
    const responseUrl = `https://api.github.com/gists/${GIST_ID}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 30) { 
                clearInterval(interval); 
                reject("Timeout: Backend is taking too long."); 
            }
            
            try {
                const res = await fetch(responseUrl, {
                    headers: { 'Authorization': `token ${GH_PAT}` }
                });
                const gistData = await res.json();
                const fileName = `res-${requestId}.json`;
                
                if (gistData.files && gistData.files[fileName]) {
                    const data = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    data.status === 200 ? resolve(data) : reject(data.error);
                }
            } catch (e) { 
                console.log("Checking for response..."); 
            }
        }, 2000);
    });
}

// 4. HELPER: Fetch Poll Results
async function fetchPollResults() {
    const responseUrl = `https://api.github.com/gists/${GIST_ID}`;
    try {
        const res = await fetch(responseUrl, {
            headers: { 'Authorization': `token ${GH_PAT}` }
        });
        const gistData = await res.json();
        // Ensure this file exists in your Gist!
        if (gistData.files['public_polls.json']) {
            return JSON.parse(gistData.files['public_polls.json'].content);
        }
        return [];
    } catch (e) {
        return [];
    }
}
