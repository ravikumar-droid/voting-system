/**
 * SECUREVOTE ULTRA-STABLE API v5.0
 * Strategy: Smart Delayed Polling to bypass 503/CORS errors.
 */

console.log("⚡ Turbo API: Initializing Stable Core...");

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
 * TURBO DISPATCH
 */
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const workflowFile = workflows[actionType];
    const fullPayload = { ...payload, requestId, actionType };
    
    console.log(`🚀 [${actionType}] Triggering Backend...`);

    // 1. Fire the trigger (Don't await it yet)
    const triggerTask = triggerWorkflow(workflowFile, fullPayload);

    // 2. THE BOOT DELAY (Crucial for Speed)
    // We wait 7 seconds because a GitHub Action NEVER finishes faster than this.
    // This saves us from wasting 7-10 attempts and getting blocked by GitHub.
    await new Promise(r => setTimeout(r, 7000)); 

    // 3. START POLLING (Now that the backend is actually running)
    const response = await pollSmart(requestId);
    
    await triggerTask; // Ensure trigger was sent successfully
    return response;
}

async function triggerWorkflow(file, payload) {
    return fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${file}/dispatches`, {
        method: "POST",
        headers: {
            "Accept": "application/vnd.github.v3+json",
            "Authorization": `Bearer ${GH_PAT}`
        },
        body: JSON.stringify({ ref: "main", inputs: { payload: JSON.stringify(payload) } })
    });
}

/**
 * SMART POLLING: Starts after the boot window.
 * Should resolve in 3–6 attempts.
 */
async function pollSmart(requestId) {
    const gistApi = `https://api.github.com/gists/${GIST_ID}`;
    const fileName = `res-${requestId}.json`;
    
    return new Promise((resolve, reject) => {
        let count = 0;
        const interval = setInterval(async () => {
            count++;
            console.log(`⏳ Scanning Database... Attempt ${count}`);

            if (count > 20) { 
                clearInterval(interval); 
                reject("Backend timeout. Please check GitHub Actions tab."); 
            }
            
            try {
                // Fetch WITHOUT heavy cache headers to avoid 503/CORS blocks
                const res = await fetch(`${gistApi}?t=${Date.now()}`, {
                    headers: { "Authorization": `token ${GH_PAT}` }
                });

                if (res.status === 503) {
                    console.warn("GitHub is busy, retrying...");
                    return;
                }

                const gistData = await res.json();
                
                if (gistData.files && gistData.files[fileName]) {
                    const content = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    console.log(`✅ Success in ${count} attempts! (Total time: ~${7 + (count * 1.5)}s)`);
                    
                    // Cleanup in background
                    cleanup(fileName);
                    
                    if (content.status === 200) resolve(content);
                    else reject(content.error);
                }
            } catch (e) { /* Network glitch - keep polling */ }
        }, 1500); // 1.5s is the "Sweet Spot" to avoid GitHub rate limits
    });
}

async function fetchPollResults() {
    try {
        const res = await fetch(`https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`, { 
            headers: { "Authorization": `token ${GH_PAT}` }
        });
        const gistData = await res.json();
        return JSON.parse(gistData.files["public_polls.json"].content);
    } catch (e) { return []; }
}

function cleanup(file) {
    fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: "PATCH",
        headers: { "Authorization": `token ${GH_PAT}` },
        body: JSON.stringify({ files: { [file]: null } })
    }).catch(()=>{});
}

console.log("✅ Turbo API: Ready & Stable!");
