const fs = require('fs');
const path = require('path');

// Create a dummy image
const dummyImagePath = path.join(__dirname, 'test_cleanup.jpg');
// Create a fake jpg file (header only) to pass mimetype check if needed, 
// but our server checks mimetype which might fail on text file.
// Let's try to just write text and name it .jpg, multer mimetype check might rely on extension or magic numbers.
// If it relies on magic numbers, this will fail.
// Let's write a minimal valid JPG header.
const jpgHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]);
fs.writeFileSync(dummyImagePath, jpgHeader);

async function runCleanupVerification() {
    const fetch = (await import('node-fetch')).default;
    const FormData = (await import('form-data')).default;

    const BASE_URL = 'http://localhost:3000';
    let apiKey;
    let uploadedUrl;

    console.log('--- Starting Cleanup Verification ---');

    // 1. Get API Key
    try {
        const res = await fetch(`${BASE_URL}/api/key`, { method: 'POST' });
        const data = await res.json();
        apiKey = data.apiKey;
        console.log('✅ API Key:', apiKey);
    } catch (e) {
        console.error('❌ Error getting key');
        return;
    }

    // 2. Upload with 5 seconds expiration
    try {
        const form = new FormData();
        form.append('image', fs.createReadStream(dummyImagePath), 'test_cleanup.jpg');
        form.append('expiration', '5'); // 5 seconds

        const res = await fetch(`${BASE_URL}/upload?key=${apiKey}`, { method: 'POST', body: form });
        const data = await res.json();
        
        if (data.success) {
            uploadedUrl = data.data.url;
            console.log('✅ Uploaded with 5s expiration:', uploadedUrl);
        } else {
            console.error('❌ Upload failed:', data);
            return;
        }
    } catch (e) {
        console.error('❌ Error uploading:', e);
        return;
    }

    // 3. Wait for cleanup
    console.log('⏳ Waiting 70 seconds for cleanup (Cron runs every 60s)...');
    
    // We need to wait enough time for the cron to trigger. 
    // Cron runs every minute (* * * * *). 
    // If we upload at 10:00:55, it expires at 10:01:00. Cron might run at 10:01:00 or 10:02:00.
    // Safest is to wait slightly more than 1 minute.
    
    setTimeout(async () => {
        // Check if file exists by trying to fetch it
        const res = await fetch(uploadedUrl);
        if (res.status === 404) {
            console.log('✅ File successfully deleted (404 Not Found)');
        } else {
            console.log('❌ File still exists (Status:', res.status, ')');
        }
        console.log('--- Cleanup Verification Complete ---');
    }, 70000);
}

runCleanupVerification();
