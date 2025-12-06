require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const User = require('./models/User');
const Image = require('./models/Image');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB Connected to:', mongoose.connection.db.databaseName);
        
        // Ensure collections exist
        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();
        const collectionNames = collections.map(c => c.name);
        
        if (!collectionNames.includes('users')) {
            await db.createCollection('users');
            console.log('✅ Collection "users" created');
        } else {
            console.log('✓ Collection "users" exists');
        }
        
        if (!collectionNames.includes('images')) {
            await db.createCollection('images');
            console.log('✅ Collection "images" created');
        } else {
            console.log('✓ Collection "images" exists');
        }
    })
    .catch(err => console.error('MongoDB Connection Error:', err));

const cron = require('node-cron');

// ... (previous imports)

// Multer Config with Security Validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images are allowed (jpeg, jpg, png, gif, webp)!'));
        }
    }
});

// Cron Job for File Cleanup (Runs every minute for testing, change to hour in prod)
cron.schedule('* * * * *', async () => {
    console.log('Running cleanup job...');
    try {
        const now = new Date();
        const expiredImages = await Image.find({ expireAt: { $lt: now } });

        for (const img of expiredImages) {
            const filePath = path.join(__dirname, img.path); // img.path is relative 'uploads/filename' or absolute? 
            // In upload route: path: req.file.path which is 'uploads\\filename' on windows
            
            // Check if file exists and delete
            // We need to be careful about path resolution. 
            // req.file.path from multer is relative to cwd usually.
            
            // Let's ensure we have the correct absolute path
            const absolutePath = path.resolve(img.path);

            if (fs.existsSync(absolutePath)) {
                fs.unlinkSync(absolutePath);
                console.log(`Deleted file: ${absolutePath}`);
            }
            
            // Delete from DB
            await Image.deleteOne({ _id: img._id });
            console.log(`Deleted DB record: ${img._id}`);
        }
    } catch (err) {
        console.error('Error in cleanup job:', err);
    }
});

// Routes

// 1. Generate API Key
app.post('/api/key', async (req, res) => {
    try {
        const apiKey = crypto.randomUUID();
        const user = new User({ apiKey });
        await user.save();
        res.json({ success: true, apiKey });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Debug: List all users (for testing)
app.get('/api/users', async (req, res) => {
    try {
        const users = await User.find({});
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Debug: List all images (for testing)
app.get('/api/images', async (req, res) => {
    try {
        const images = await Image.find({});
        res.json({ success: true, count: images.length, images });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// List MY images (user's own images)
app.get('/api/my-images', async (req, res) => {
    const apiKey = req.query.key;
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API Key required' });
    }

    try {
        // Verify API key exists
        const user = await User.findOne({ apiKey });
        if (!user) {
            return res.status(401).json({ success: false, error: 'Invalid API Key' });
        }

        // Find only images belonging to this user
        const images = await Image.find({ uploaderApiKey: apiKey });
        
        res.json({
            success: true,
            count: images.length,
            data: images.map(img => ({
                id: img._id,
                title: img.originalName,
                url: img.url,
                date: img.createdAt,
                expiration: img.expireAt
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Middleware to check API Key
const checkApiKey = async (req, res, next) => {
    const apiKey = req.query.key || req.body.key;
    if (!apiKey) {
        return res.status(401).json({ success: false, error: 'API Key required' });
    }
    const user = await User.findOne({ apiKey });
    if (!user) {
        return res.status(401).json({ success: false, error: 'Invalid API Key' });
    }
    req.user = user;
    next();
};

// 2. Upload Image
app.post('/upload', checkApiKey, upload.single('image'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    try {
        const expiration = req.body.expiration ? parseInt(req.body.expiration) : null;
        let expireAt = null;
        if (expiration) {
            expireAt = new Date(Date.now() + expiration * 1000);
        }

        const image = new Image({
            filename: req.file.filename,
            originalName: req.file.originalname,
            path: req.file.path,
            url: `${BASE_URL}/uploads/${req.file.filename}`,
            deleteUrl: `${BASE_URL}/image/${req.file.filename}/delete`, // Simplified delete URL
            uploaderApiKey: req.user.apiKey,
            expireAt: expireAt
        });

        await image.save();

        res.json({
            data: {
                id: image._id,
                title: image.originalName,
                url: image.url,
                delete_url: image.deleteUrl,
                expiration: expiration
            },
            success: true
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Get Image Details
app.get('/image/:id', async (req, res) => {
    try {
        // Try to find by ID first, then by filename if ID fails (for flexibility)
        let image;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
             image = await Image.findById(req.params.id);
        }
        
        if (!image) {
             image = await Image.findOne({ filename: req.params.id });
        }

        if (!image) {
            return res.status(404).json({ success: false, error: 'Image not found' });
        }

        res.json({
            data: {
                id: image._id,
                title: image.originalName,
                url: image.url,
                date: image.createdAt,
                expiration: image.expireAt
            },
            success: true
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Delete Image
app.delete('/image/:id', async (req, res) => {
    const apiKey = req.query.key || req.body.key;
    // Note: Requirement said "manual delete", usually requires ownership check or admin.
    // Assuming simple ownership check via API key if provided, or just open for now based on "deleteUrl" pattern often used in these clones.
    // However, for better security, let's enforce API key ownership.
    
    if (!apiKey) {
         return res.status(401).json({ success: false, error: 'API Key required to delete' });
    }

    try {
        let image;
        if (mongoose.Types.ObjectId.isValid(req.params.id)) {
             image = await Image.findById(req.params.id);
        }
         if (!image) {
             image = await Image.findOne({ filename: req.params.id });
        }

        if (!image) {
            return res.status(404).json({ success: false, error: 'Image not found' });
        }

        if (image.uploaderApiKey !== apiKey) {
             return res.status(403).json({ success: false, error: 'Unauthorized: You did not upload this image' });
        }

        // Delete file from disk
        if (fs.existsSync(image.path)) {
            fs.unlinkSync(image.path);
        }

        await Image.deleteOne({ _id: image._id });

        res.json({ success: true, message: 'Image deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Special route for the "deleteUrl" which might be GET or DELETE. 
// Often delete_url is a GET link with a token, but here we'll stick to REST DELETE with Key for simplicity as per requirements.
// But to make the `deleteUrl` in response work easily in browser/Postman, let's add a GET version that acts as a trigger if we wanted, 
// but strictly following REST, DELETE is better. 
// Let's add a specific route for the "deleteUrl" field we returned: `/image/:filename/delete`
app.get('/image/:filename/delete', async (req, res) => {
     // This is a helper to allow deletion via GET if they have the key in query param
     // Reuses logic?
     // For now, let's just instruct user to use DELETE method in docs.
     res.status(405).json({success: false, error: 'Use DELETE method with API Key to delete this image.'});
});


app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
