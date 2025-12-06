const fs = require('fs');
const path = require('path');

// Create a dummy image
const dummyImagePath = path.join(__dirname, 'test_image.txt');
fs.writeFileSync(dummyImagePath, 'This is a test image content');

async function runVerification() {
    const fetch = (await import('node-fetch')).default;
    const FormData = (await import('form-data')).default;
    const fs = require('fs');

    const BASE_URL = 'http://localhost:3000';
    let apiKey;
    let imageId;
    let deleteUrl;

    console.log('--- Starting Verification ---');

    // 1. Get API Key
    try {
        const res = await fetch(`${BASE_URL}/api/key`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            apiKey = data.apiKey;
            console.log('✅ API Key Generated:', apiKey);
        } else {
            console.error('❌ Failed to generate API Key:', data);
            return;
        }
    } catch (e) {
        console.error('❌ Error generating API Key:', e);
        return;
    }

    // 2. Upload Image
    try {
        const form = new FormData();
        form.append('key', apiKey);
        form.append('image', fs.createReadStream(dummyImagePath), 'test_image.txt');

        const res = await fetch(`${BASE_URL}/upload?key=${apiKey}`, { method: 'POST', body: form });
        const data = await res.json();
        
        if (data.success) {
            imageId = data.data.id;
            deleteUrl = data.data.delete_url; // Note: This is the URL string, we might need to parse it or just construct the delete call manually as per our script logic
            console.log('✅ Image Uploaded:', data.data.url);
            console.log('   ID:', imageId);
        } else {
            console.error('❌ Failed to upload image:', data);
            return;
        }
    } catch (e) {
        console.error('❌ Error uploading image:', e);
        return;
    }

    // 3. Get Image Details
    try {
        const res = await fetch(`${BASE_URL}/image/${imageId}`);
        const data = await res.json();
        if (data.success) {
            console.log('✅ Image Details Retrieved:', data.data.title);
        } else {
            console.error('❌ Failed to get image details:', data);
        }
    } catch (e) {
        console.error('❌ Error getting image details:', e);
    }

    // 4. Delete Image
    try {
        // Construct delete URL manually to ensure we pass the key as query param or body
        // The deleteUrl in response is likely just the path, but let's use the API endpoint directly
        const res = await fetch(`${BASE_URL}/image/${imageId}?key=${apiKey}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            console.log('✅ Image Deleted');
        } else {
            console.error('❌ Failed to delete image:', data);
        }
    } catch (e) {
        console.error('❌ Error deleting image:', e);
    }
    
    console.log('--- Verification Complete ---');
}

runVerification();
