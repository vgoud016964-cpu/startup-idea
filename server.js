import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const app = express();
app.use(cors());
app.use(express.json());

// 1. DATABASE CONNECTION
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// 2. CLOUDINARY CONFIG (Safe check)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// 3. MULTER CONFIG (For image uploads)
const upload = multer({ storage: multer.memoryStorage() });

// 4. MODELS
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

const dataSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  data: { type: Object, default: {} } 
});
const UserData = mongoose.model('UserData', dataSchema);

// 5. ROUTES
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Account already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    
    await new UserData({ email, data: {} }).save();
    res.status(201).json({ message: "Account created", name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during registration." });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Incorrect email or password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect email or password." });
    
    res.status(200).json({ message: "Login successful", name: user.name });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error during login." });
  }
});

app.post('/api/get-data', async (req, res) => {
  try {
    const { email } = req.body;
    const userData = await UserData.findOne({ email });
    if (!userData) return res.status(404).json({ message: "Data not found" });
    res.status(200).json(userData.data);
  } catch (error) {
    res.status(500).json({ message: "Server error fetching data." });
  }
});

app.post('/api/save-data', async (req, res) => {
  try {
    const { email, data } = req.body;
    await UserData.findOneAndUpdate({ email }, { data }, { upsert: true, new: true });
    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error saving data." });
  }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided." });
    const b64 = Buffer.from(req.file.buffer).toString("base64");
    let dataURI = "data:" + req.file.mimetype + ";base64," + b64;
    
    const result = await cloudinary.uploader.upload(dataURI, { folder: "solocare_groceries" });
    res.status(200).json({ url: result.secure_url });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Image upload failed." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`SOLOCARE API running on port ${PORT}`));
