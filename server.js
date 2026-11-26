const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs'); 

const app = express();
app.use(cors()); 
app.use(express.json()); 

// Uses your environment variable from Render
const MONGO_URI = process.env.MONGO_URI; 

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));

// User Database Model
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});
const User = mongoose.model('User', userSchema);

// Register Route
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    
    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Account already exists. Please sign in." });

    // Encrypt password for security
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Save to MongoDB
    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();
    
    res.status(201).json({ message: "Account created successfully", name });
  } catch (error) {
    res.status(500).json({ message: "Server error during registration." });
  }
});

// Login Route
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user in MongoDB
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Incorrect email or password." });

    // Check if password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Incorrect email or password." });
    
    res.status(200).json({ message: "Login successful", name: user.name });
  } catch (error) {
    res.status(500).json({ message: "Server error during login." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`SOLOCARE API running on port ${PORT}`));
