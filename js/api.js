
const GH_OWNER = "ravikumar-droid";
const GH_REPO = "voting-system";
const GH_PAT = "PLACEHOLDER_TOKEN";

// 2. DATABASE CONFIGURATION
const GIST_ID = "c5a19b5d804791fe34ce171d15b6f1f0";

// 3. BACKEND WORKFLOW MAPPING
const workflows = {
    "login": "auth.yml",
    "register": "auth.yml",
    "vote": "vote.yml",
    "admin_create_poll": "admin.yml",
    "admin_approve_user": "admin.yml",
    "admin_toggle_poll": "admin.yml",
    "admin_toggle_results": "admin.yml",
    "admin_delete_poll": "admin.yml"
};

/**
 * Sends a request to GitHub Actions (The Backend)
 */
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const workflowFile = workflows[actionType];
    
    if (!workflowFile) {
        throw new Error("Action not found in workflow map.");
    }

    const fullPayload = { 
        ...payload, 
        requestId: requestId, 
        actionType: actionType 
    };

    console.log("🚀 Dispatching:", actionType);

    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`, {
        method: "POST",
        headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${GH_PAT}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            ref: "main",
            inputs: { payload: JSON.stringify(fullPayload) }
        })
    });

    if (!res.ok) {
        throw new Error("Backend connection failed. Status: " + res.status);
    }
    
    return await pollForResponse(requestId);
}

/**
 * Polls the Secret Gist for the backend's response
 */
async function pollForResponse(requestId) {
    const responseUrl = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            console.log(`⏳ Waiting for response... ${attempts}/30`);

            if (attempts > 30) { 
                clearInterval(interval); 
                reject("Timeout: Backend response not found."); 
            }
            
            try {
                const res = await fetch(responseUrl, {
                    headers: { "Authorization": `token ${GH_PAT}` }
                });
                const gistData = await res.json();
                const fileName = `res-${requestId}.json`;
                
                if (gistData.files && gistData.files[fileName]) {
                    const data = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    
                    if (data.status === 200) {
                        resolve(data);
                    } else {
                        reject(data.error);
                    }
                }
            } catch (e) { 
                // Ignore errors during polling
            }
        }, 3000);
    });
}

/**
 * Fetches the latest election results from the Gist
 */
async function fetchPollResults() {
    const url = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    try {
        const res = await fetch(url, { 
            headers: { "Authorization": `token ${GH_PAT}` } 
        });
        const gistData = await res.json();
        
        if (gistData.files["public_polls.json"]) {
            return JSON.parse(gistData.files["public_polls.json"].content);
        }
        return [];
    } catch (e) {
        console.error("Poll fetch error:", e);
        return [];
    }
}
