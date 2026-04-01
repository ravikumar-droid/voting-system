// --- CONFIGURATION ---
const GH_OWNER = "YOUR_GITHUB_USERNAME";
const GH_REPO = "YOUR_REPO_NAME";
const GH_PAT = "YOUR_SCOPED_GITHUB_PAT"; // Must only have action dispatch permissions

const MONGO_DATA_URL = "YOUR_MONGO_DATA_API_ENDPOINT/action";
const MONGO_DATA_KEY = "YOUR_MONGO_READ_ONLY_API_KEY";
const CLUSTER_NAME = "Cluster0";

// Generates unique request ID
const generateUUID = () => crypto.randomUUID();

// Sends request to GitHub Actions
async function dispatchAction(eventType, payload) {
    const requestId = generateUUID();
    const fullPayload = { ...payload, requestId };

    await fetch(`https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/dispatches`, {
        method: 'POST',
        headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${GH_PAT}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_type: eventType, client_payload: fullPayload })
    });

    return await pollForResponse(requestId);
}

// Polls MongoDB Data API for the response
async function pollForResponse(requestId) {
    return new Promise((resolve, reject) => {
        const interval = setInterval(async () => {
            const res = await fetch(`${MONGO_DATA_URL}/findOne`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'api-key': MONGO_DATA_KEY },
                body: JSON.stringify({
                    dataSource: CLUSTER_NAME, database: "voting_db", collection: "Responses",
                    filter: { requestId: requestId }
                })
            });
            const { document } = await res.json();
            
            if (document) {
                clearInterval(interval);
                if (document.status === 200) resolve(document.data);
                else reject(document.data.error);
            }
        }, 2000); // Check every 2 seconds
    });
}
