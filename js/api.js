// js/api.js
const GH_OWNER = "ravikumar-droid";
const GH_REPO = "voting-system";
const GH_PAT = "PLACEHOLDER_TOKEN"; 

// Update this to your Secret Gist ID
const GIST_ID = "PASTE_YOUR_GIST_ID_HERE"; 

async function pollForResponse(requestId) {
    // We check the Gist directly!
    const responseUrl = `https://api.github.com/gists/${GIST_ID}`;
    
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const interval = setInterval(async () => {
            attempts++;
            if (attempts > 30) { clearInterval(interval); reject("Timeout"); }
            
            try {
                const res = await fetch(responseUrl, {
                    headers: { 'Authorization': `token ${GH_PAT}` }
                });
                const gistData = await res.json();
                const fileName = `res-${requestId}.json`;
                
                if (gistData.files[fileName]) {
                    const data = JSON.parse(gistData.files[fileName].content);
                    clearInterval(interval);
                    data.status === 200 ? resolve(data) : reject(data.error);
                }
            } catch (e) { console.log("Waiting..."); }
        }, 2000);
    });
}
