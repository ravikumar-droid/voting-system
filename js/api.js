// js/api.js

// DO NOT CHANGE THESE MANUALLY - THE DEPLOYER WILL FIX THEM
const GH_OWNER = "PLACEHOLDER_USER"; 
const GH_REPO = "PLACEHOLDER_REPO"; 
const GH_PAT = "PLACEHOLDER_TOKEN"; 

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

    if (!res.ok) throw new Error("Backend connection failed. Status: " + res.status);
    return await pollForResponse(requestId);
}

async function pollForResponse(requestId) {
    const responseUrl = `https://${GH_OWNER}.github.io/${GH_REPO}/api/responses/${requestId}.json`;
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 30) { clearInterval(interval); reject("Timeout waiting for backend"); }
            try {
                const response = await fetch(`${responseUrl}?t=${Date.now()}`);
                if (response.ok) {
                    const data = await response.json();
                    clearInterval(interval);
                    data.status === 200 ? resolve(data) : reject(data.error);
                }
            } catch (e) {}
        }, 2000);
    });
}

async function fetchPollResults() {
    const url = `https://${GH_OWNER}.github.io/${GH_REPO}/api/public_polls.json?t=${Date.now()}`;
    const res = await fetch(url);
    return res.ok ? await res.json() : [];
}
