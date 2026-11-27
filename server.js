import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const app = express();

const allowedOrigins = [
  'https://vgoud016964-cpu.github.io',
  process.env.FRONTEND_URL
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '2mb' }));

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. CLOUDINARY CONFIG
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 3. MULTER CONFIG
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 }
});

// 4. MODELS
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const dataSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
});
const UserData = mongoose.model('UserData', dataSchema);

// 5. AUTH MIDDLEWARE
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Authentication required.' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
}

// 6. ROUTES
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.post('/api/register', async (req, res) => {
  try {
    const name = req.body.name?.trim();
    const email = req.body.email?.toLowerCase().trim();
    const password = req.body.password;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters.' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Account already exists.' });

    const hashedPassword = await bcrypt.hash(password, 10);
    await new User({ name, email, password: hashedPassword }).save();
    await new UserData({ email, data: {} }).save();

    const token = jwt.sign({ email, name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(201).json({ message: 'Account created', name, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const email = req.body.email?.toLowerCase().trim();
    const password = req.body.password;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: 'Incorrect email or password.' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Incorrect email or password.' });

    const token = jwt.sign({ email: user.email, name: user.name }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.status(200).json({ message: 'Login successful', name: user.name, token });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

app.post('/api/get-data', requireAuth, async (req, res) => {
  try {
    const userData = await UserData.findOne({ email: req.user.email });
    if (!userData) return res.status(200).json({});
    res.status(200).json(userData.data || {});
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error fetching data.' });
  }
});

app.post('/api/save-data', requireAuth, async (req, res) => {
  try {
    const { data } = req.body;
    await UserData.findOneAndUpdate(
      { email: req.user.email },
      { data: data ?? {} },
      { upsert: true, new: true }
    );
    res.status(200).json({ message: 'Data saved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error saving data.' });
  }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No image file provided.' });
    const b64 = Buffer.from(req.file.buffer).toString('base64');
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataURI, { folder: 'solocare_groceries' });
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Image upload failed.' });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`SOLOCARE API running on port ${PORT}`));
