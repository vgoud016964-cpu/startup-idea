import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB (Render provides MONGO_URI)
const MONGO_URI = process.env.MONGO_URI; 
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// --- DATABASE MODELS ---

// 1. User Model (for Login/Register)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// 2. User Data Model (for Groceries, Moods, Medicines, etc.)
const dataSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  data: { type: Object, default: {} } 
});
const UserData = mongoose.model('UserData', dataSchema);

// --- API ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Account already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    
    // Initialize empty data profile
    await new UserData({ email, data: {} }).save();

    res.status(201).json({ message: "Account created", name });
  } catch (error) {
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Incorrect email or password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect email or password." });
    
    res.status(200).json({ message: "Login successful", name: user.name });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
});

// Get User Data
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

// Save User Data
app.post('/api/save-data', async (req, res) => {
  try {
    const { email, data } = req.body;
    await UserData.findOneAndUpdate(
      { email }, 
      { data }, 
      { upsert: true, new: true }
    );
    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error saving data." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`SOLOCARE API running on port ${PORT}`));
