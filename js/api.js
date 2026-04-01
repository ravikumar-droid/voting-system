// js/api.js

// 1. CONFIGURATION (The Deployer fills these)
const GH_OWNER = "ravikumar-droid"; 
const GH_REPO = "voting-system"; 
const GH_PAT = "PLACEHOLDER_TOKEN"; 

// 2. YOUR SECRET GIST ID (Replace this manually with your actual Gist ID)
const GIST_ID = "PASTE_YOUR_GIST_ID_HERE"; 

const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml',
    'admin_create_poll': 'admin.yml',
    'admin_approve_user': 'admin.yml'
};

// 3. THE MISSING FUNCTION: dispatchAction
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const fullPayload = { ...payload, requestId, actionType };
    const workflowFile = workflows[actionType];

    console.log(`🚀 Dispatching ${actionType}...`);

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

    if (!res.ok) throw new Error("Backend connection failed. Status: " + res.status);
    
    // After sending the request, start looking for the answer in the Gist
    return await pollForResponse(requestId);
}

// 4. POLLING FUNCTION (Checks the Gist for the answer)
async function pollForResponse(requestId) {
    const responseUrl = `https://api.github.com/gists/${GIST_ID}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 30) { 
                clearInterval(interval); 
                reject("Timeout: The backend is taking too long."); 
            }
            
            try {
                const res = await fetch(responseUrl, {
                    headers: { 'Authorization': `token ${GH_PAT}` }
                });
                const gistData = await res.json();
                const fileName = `res-${requestId}.json`;
                
                // If the backend has finished, it will have created this file in the Gist
                if (gistData.files && gistData.files[fileName]) {
                    const data = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    data.status === 200 ? resolve(data) : reject(data.error);
                }
            } catch (e) { 
                console.log("Waiting for backend response..."); 
            }
        }, 2000); // Check every 2 seconds
    });
}

// 5. HELPER: Fetch Poll Results
async function fetchPollResults() {
    // We check the Gist for the latest polls too
    const responseUrl = `https://api.github.com/gists/${GIST_ID}`;
    try {
        const res = await fetch(responseUrl, {
            headers: { 'Authorization': `token ${GH_PAT}` }
        });
        const gistData = await res.json();
        return JSON.parse(gistData.files['public_polls.json'].content);
    } catch (e) {
        console.error("Failed to load polls:", e);
        return [];
    }
}
