// These will be automatically filled by the "Deploy" action
const GH_OWNER = "ravikumar-droid"; 
const GH_REPO = "voting-system"; 
const GH_PAT = "TOKEN_INJECTED_BY_ACTION"; // DO NOT CHANGE THIS MANUALLY

const workflows = {
    'login': 'auth.yml',
    'register': 'auth.yml',
    'vote': 'vote.yml'
};

const getResponseUrl = (requestId) => `https://${GH_OWNER}.github.io/${GH_REPO}/api/responses/${requestId}.json`;
const getPollsUrl = () => `https://${GH_OWNER}.github.io/${GH_REPO}/api/public_polls.json`;
const generateUUID = () => crypto.randomUUID();

async function dispatchAction(actionType, payload) {
    const requestId = generateUUID();
    const fullPayload = { ...payload, requestId, actionType };
    const workflowFile = workflows[actionType];

    const res = await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/actions/workflows/${workflowFile}/dispatches`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GH_PAT}`, // Uses the injected token
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            ref: "main",
            inputs: { payload: JSON.stringify(fullPayload) }
        })
    });

    if (!res.ok) {
        const err = await res.json();
        console.error(err);
        throw new Error("Backend is waking up or Token is invalid. Please wait 10 seconds and try again.");
    }
    return await pollForResponse(requestId);
}

// ... pollForResponse remains the same ...
