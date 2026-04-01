// js/api.js
const GH_OWNER = "ravikumar-droid"; 
const GH_REPO = "voting-system"; 
const GH_PAT = "PLACEHOLDER_TOKEN"; 
const GIST_ID = "c5a19b5d804791fe34ce171d15b6f1f0"; 

const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml',
    'admin_create_poll': 'admin.yml',
    'admin_approve_user': 'admin.yml'
};

async function dispatchAction(actionType, payload) {
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

    if (!res.ok) throw new Error("Backend Busy (422/401/404)");
    return await pollForResponse(requestId);
}

async function pollForResponse(requestId) {
    // Add ?t= to the URL to bypass GitHub's API cache
    const responseUrl = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            console.log(`Checking Gist for response... Attempt ${attempts}`);

            if (attempts > 30) { 
                clearInterval(interval); 
                reject("Timeout: Gist response not found. (Try cleaning your Gist files!)"); 
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
            } catch (e) { console.log("Searching..."); }
        }, 3000); // Check every 3 seconds
    });
}

// Helper to fetch polls for the dashboard
async function fetchPollResults() {
    const url = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    try {
        const res = await fetch(url, { headers: { 'Authorization': `token ${GH_PAT}` } });
        const gistData = await res.json();
        return JSON.parse(gistData.files['public_polls.json'].content);
    } catch (e) { return []; }
}
