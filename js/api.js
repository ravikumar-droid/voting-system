/**
 * SECURE VOTING SYSTEM - CORE API
 * Repository: ravikumar-droid/voting-system
 */

// 1. CONFIGURATION (Injected by deploy.yml)
const GH_OWNER = "ravikumar-droid"; 
const GH_REPO = "voting-system"; 
const GH_PAT = "PLACEHOLDER_TOKEN"; 

// 2. DATABASE CONFIGURATION
const GIST_ID = "c5a19b5d804791fe34ce171d15b6f1f0"; 

// 3. BACKEND WORKFLOW MAPPING
const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml',
    'admin_create_poll': 'admin.yml',
    'admin_approve_user': 'admin.yml',
    'admin_toggle_poll': 'admin.yml' // New: Feature to STOP/START elections
    'admin_toggle_results': 'admin.yml' // Add this mapping
};

/**
 * Sends a request to GitHub Actions (The Backend)
 */
async function dispatchAction(actionType, payload) {
    const requestId = crypto.randomUUID();
    const fullPayload = { ...payload, requestId, actionType };
    const workflowFile = workflows[actionType];

    if (!workflowFile) throw new Error("Unknown action type: " + actionType);

    console.log(`🚀 Dispatching ${actionType} (ID: ${requestId})...`);

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
    
    return await pollForResponse(requestId);
}

/**
 * Polls the Secret Gist for the backend's response
 */
async function pollForResponse(requestId) {
    // Cache busting using timestamp
    const responseUrl = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            console.log(`⏳ Checking Gist for response... Attempt ${attempts}/30`);

            if (attempts > 30) { 
                clearInterval(interval); 
                reject("Timeout: Backend response not found. (Check Gist files or Action logs)"); 
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
                    
                    if (data.status === 200) {
                        console.log("✅ Success:", data);
                        resolve(data);
                    } else {
                        console.error("❌ Backend Error:", data.error);
                        reject(data.error);
                    }
                }
            } catch (e) { 
                console.warn("Polling error, retrying..."); 
            }
        }, 3000); // Check every 3 seconds
    });
}

/**
 * Fetches the latest election results from the Gist
 */
async function fetchPollResults() {
    const url = `https://api.github.com/gists/${GIST_ID}?t=${Date.now()}`;
    try {
        const res = await fetch(url, { 
            headers: { 'Authorization': `token ${GH_PAT}` } 
        });
        const gistData = await res.json();
        
        // Return public_polls.json which contains counts and status
        if (gistData.files['public_polls.json']) {
            return JSON.parse(gistData.files['public_polls.json'].content);
        }
        return [];
    } catch (e) {
        console.error("Critical: Could not fetch polls.", e);
        return [];
    }
}

/**
 * UTILITY: Calculate winner and stats for the UI
 */
function calculateElectionStats(poll) {
    const totalVotes = poll.results.reduce((a, b) => a + b, 0);
    const maxVotes = Math.max(...poll.results);
    const winnerIndex = poll.results.indexOf(maxVotes);
    
    return {
        total: totalVotes,
        isLeading: totalVotes > 0 ? poll.options[winnerIndex] : "None",
        leadingVotes: maxVotes,
        percentage: totalVotes > 0 ? Math.round((maxVotes / totalVotes) * 100) : 0
    };
}
