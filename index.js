import express from 'express';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = process.env.PORT || 3000;
const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = 'lemon16_db';

let usersCollection;

// Connect to MongoDB
async function connectDB() {
    try {
        const client = new MongoClient(mongoUri);
        await client.connect();
        console.log('Connected to MongoDB');
        const db = client.db(dbName);
        usersCollection = db.collection('users');
    } catch (error) {
        console.error('MongoDB connection error:', error);
        process.exit(1);
    }
}
connectDB();

// Multer for file uploads
const storage = multer.diskStorage({
    destination: 'public/uploads/',
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, Date.now() + ext);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const types = /jpeg|jpg|png|gif/;
        const extname = types.test(path.extname(file.originalname).toLowerCase());
        const mimetype = types.test(file.mimetype);
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Please upload a valid image (jpg, png, gif, <5MB).'));
        }
    }
});

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/register', (req, res, next) => {
    upload.single('profilePic')(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: err.message === 'File too large' ? 'Image must be less than 5MB.' : 'Upload error. Try again.' });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
}, async (req, res) => {
    try {
        const { name, age, gender, location, interests, interestedIn, displayConsent } = req.body;
        if (!name || !age || !gender || !location || !interests || !interestedIn || !req.file || displayConsent === undefined) {
            return res.status(400).json({ success: false, message: 'All fields are required.' });
        }
        if (/^\d+$/.test(name)) {
            return res.status(400).json({ success: false, message: 'Name cannot be only numbers.' });
        }
        const ageNum = parseInt(age);
        if (isNaN(ageNum) || ageNum < 18) {
            return res.status(400).json({ success: false, message: 'Age must be 18 or older.' });
        }
        const userId = Math.floor(100000 + Math.random() * 900000);
        const user = {
            userId,
            name,
            age: ageNum,
            gender: gender.toLowerCase(),
            location,
            interests,
            interestedIn: interestedIn.toLowerCase(),
            profilePic: req.file.filename,
            displayConsent: displayConsent === 'true',
            source: 'web',
            isSubscribed: false,
            swipeCount: 20,
            swipeCounter: 0,
            likedUsers: [],
            dislikedUsers: [],
            editAttempts: 2,
            joinDate: new Date()
        };
        await usersCollection.insertOne(user);
        const redirectUrl = `https://t.me/Lemon16Bot?start=web_${userId}`;
        res.json({ success: true, redirectUrl });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ success: false, message: 'Server error. Please try again later.' });
    }
});

app.get('/members', async (req, res) => {
    try {
        const members = await usersCollection
            .find({ displayConsent: true })
            .sort({ joinDate: -1 })
            .limit(4)
            .toArray();
        res.json(members);
    } catch (error) {
        console.error('Members fetch error:', error);
        res.status(500).json({ success: false, message: 'Error fetching members.' });
    }
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
