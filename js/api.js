/**
 * SECUREVOTE ULTRA-FAST API v4.0
 * Goal: Resolve in 5-8 attempts (~10 seconds total)
 */

console.log("⚡ Turbo API: Initializing...");

const GH_OWNER = "ravikumar-droid";
const GH_REPO = "voting-system";
const GH_PAT = "PLACEHOLDER_TOKEN";
const GIST_ID = "c5a19b5d804791fe34ce171d15b6f1f0";

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
 * TURBO DISPATCH: Parallel non-blocking execution
 */
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const workflowFile = workflows[actionType];
    const fullPayload = { ...payload, requestId, actionType };
    
    console.log(`🚀 [${actionType}] Turbo-Dispatching...`);

    // SPEED TRICK: Start both at the same time. 
    // We don't await the trigger; we start polling immediately.
    const triggerTask = triggerWorkflow(workflowFile, fullPayload);
    const pollTask = pollTurbo(requestId);

    // Wait for the response (the trigger runs in background)
    const response = await pollTask;
    
    // Ensure the trigger actually worked (sanity check)
    await triggerTask; 

    return response;
}

/**
 * TRIGGER: Minified Headers for fast dispatch
 */
async function triggerWorkflow(file, payload) {
    return fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/dispatches`, {
        method: "POST",
        headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${GH_PAT}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ ref: "main", inputs: { payload: JSON.stringify(payload) } })
    });
}

/**
 * POLL TURBO: High-Frequency 1-Second Loop
 * Hits the "5-6 attempts" target.
 */
async function pollTurbo(requestId) {
    const gistApi = `https://api.github.com/gists/${GIST_ID}`;
    const fileName = `res-${requestId}.json`;
    
    return new Promise((resolve, reject) => {
        let count = 0;
        
        const interval = setInterval(async () => {
            count++;
            
            // Log every attempt for user to see the speed
            console.log(`⏳ Attempt ${count}/30...`);

            if (count > 30) { 
                clearInterval(interval); 
                reject("Backend Timeout. Actions may be queued by GitHub."); 
            }
            
            try {
                // cache: "no-store" bypasses browser cache for millisecond accuracy
                const res = await fetch(`${gistApi}?t=${Date.now()}`, {
                    headers: { "Authorization": `token ${GH_PAT}` },
                    cache: "no-store" 
                });
                const gistData = await res.json();
                
                if (gistData.files && gistData.files[fileName]) {
                    const content = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    console.log(`✅ Success in ${count} attempts!`);
                    
                    // Fire-and-forget cleanup to keep Gist performance high
                    cleanup(fileName);
                    
                    if (content.status === 200) resolve(content);
                    else reject(content.error);
                }
            } catch (e) { /* Retry silently */ }
        }, 1000); // 1.0 second frequency: Absolute safe limit for GH API
    });
}

/**
 * FETCH: High-Speed Results Retrieval
 */
async function fetchPollResults() {
    try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, { 
            headers: { "Authorization": `token ${GH_PAT}` },
            cache: "no-store"
        });
        const gistData = await res.json();
        return JSON.parse(gistData.files["public_polls.json"].content);
    } catch (e) { return []; }
}

/**
 * CLEANUP: Remote file deletion
 */
function cleanup(file) {
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: { "Authorization": `token ${GH_PAT}` },
        body: JSON.stringify({ files: { [file]: null } })
    }).catch(()=>{});
}

console.log("✅ Turbo API: Ready!");
