/**
 * SECUREVOTE ADVANCED API v3.0
 * Optimized for Parallel Execution & High-Speed Polling
 */

console.log("🚀 api.js: Initializing High-Speed Core...");

// 1. CONFIGURATION
const GH_OWNER = "ravikumar-droid";
const GH_REPO = "voting-system";
const GH_PAT = "PLACEHOLDER_TOKEN";
const GIST_ID = "c5a19b5d804791fe34ce171d15b6f1f0";

// 2. WORKFLOW MAPPING
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
 * CORE: Dispatch and Poll in Parallel
 * This is the "Speed Trick": We don't wait for the dispatch to finish 
 * before we start looking for the answer.
 */
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const workflowFile = workflows[actionType];
    
    if (!workflowFile) throw new Error("Invalid Action Mapping");

    const fullPayload = { ...payload, requestId, actionType };
    
    console.log(`📡 [${actionType}] Launching Parallel Request...`);

    // START TRIGGER AND POLLING SIMULTANEOUSLY
    const [response] = await Promise.all([
        pollForResponse(requestId), // Start checking the Gist immediately
        triggerWorkflow(workflowFile, fullPayload) // Send the request to GitHub
    ]);

    return response;
}

/**
 * TRIGGER: Fire-and-forget GitHub Dispatch
 */
async function triggerWorkflow(file, payload) {
    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/dispatches`, {
        method: "POST",
        headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${GH_PAT}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ ref: "main", inputs: { payload: JSON.stringify(payload) } })
    });
    if (!res.ok) throw new Error(`Dispatch Failed: ${res.status}`);
    return true;
}

/**
 * POLLING: High-Frequency Aggressive Search
 * Frequency increased to 1.5 seconds for instant-feel feedback.
 */
async function pollForResponse(requestId) {
    // Aggressive Cache Busting
    const gistApi = `https://api.github.com/gists/${GIST_ID}?nocache=${Date.now()}`;
    const fileName = `res-${requestId}.json`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            
            // Log progress every 5 seconds for UI awareness
            if (attempts % 3 === 0) console.log(`⏳ Searching... (Attempt ${attempts}/40)`);

            if (attempts > 40) { 
                clearInterval(interval); 
                reject("Backend is processing slowly. Please refresh."); 
            }
            
            try {
                const res = await fetch(gistApi, {
                    headers: { "Authorization": `token ${GH_PAT}` }
                });
                const gistData = await res.json();
                
                if (gistData.files && gistData.files[fileName]) {
                    const data = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    
                    // AUTO-CLEANUP: Tell GitHub to delete the response file 
                    // This keeps the database small and future API calls fast.
                    cleanupGistResponse(fileName);

                    if (data.status === 200) {
                        console.log("✅ Request Resolved Successfully");
                        resolve(data);
                    } else {
                        reject(data.error);
                    }
                }
            } catch (e) { /* Silently retry on network blips */ }
        }, 1500); // 1.5 seconds is the sweet spot for GitHub API limits
    });
}

/**
 * CLEANUP: Deletes the temp response file from Gist
 */
async function cleanupGistResponse(fileName) {
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: { "Authorization": `token ${GH_PAT}` },
        body: JSON.stringify({ files: { [fileName]: null } })
    }).catch(() => {}); // Fire and forget
}

/**
 * FETCH: High-Speed Results Retrieval
 */
async function fetchPollResults() {
    try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, { 
            headers: { "Authorization": `token ${GH_PAT}` } 
        });
        const gistData = await res.json();
        
        if (gistData.files && gistData.files["public_polls.json"]) {
            return JSON.parse(gistData.files["public_polls.json"].content);
        }
        return [];
    } catch (e) {
        console.error("Poll Retrieval Error");
        return [];
    }
}

console.log("✅ api.js: High-Speed Core Ready!");
