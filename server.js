const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 

const app = express();
app.use(cors()); 
app.use(express.json()); 

const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// 1. User Model (for Login/Register)
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// 2. User Data Model (for Groceries, Moods, etc.)
const dataSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  data: { type: Object, default: {} } // Stores everything in one JSON object
});
const UserData = mongoose.model('UserData', dataSchema);

// --- ROUTES ---

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Account already exists." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    
    // Initialize empty data for this user
    await new UserData({ email, data: {} }).save();

    res.status(201).json({ message: "Account created", name });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
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
    res.status(500).json({ message: "Server error" });
  }
});

// GET All User Data
app.post('/api/get-data', async (req, res) => {
  try {
    const { email } = req.body;
    const userData = await UserData.findOne({ email });
    if (!userData) return res.status(404).json({ message: "Data not found" });
    res.status(200).json(userData.data);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// SAVE All User Data
app.post('/api/save-data', async (req, res) => {
  try {
    const { email, data } = req.body;
    await UserData.findOneAndUpdate(
      { email }, 
      { data }, 
      { upsert: true, new: true } // Create if doesn't exist, update if it does
    );
    res.status(200).json({ message: "Data saved successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`SOLOCARE API running on port ${PORT}`));
