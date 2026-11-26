
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';

const app = express();

const PORT = process.env.PORT || 10000;
const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;

if (!MONGO_URI || !JWT_SECRET) {
  console.error('Missing MONGO_URI or JWT_SECRET environment variable.');
  process.exit(1);
}

// CORS
const allowedOrigins = (process.env.FRONTEND_URL || '')
  .split(',')
  .map(url => url.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Origin not allowed by CORS'));
  }
}));

app.use(express.json({ limit: '1mb' }));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// MongoDB connection
mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(error => {
    console.error('MongoDB connection error:', error.message);
    process.exit(1);
  });

// USER MODEL
const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: { type: String, required: true }
}, { timestamps: true });

const User = mongoose.model('User', userSchema);

// USER DATA MODEL
const dataSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} }
});

const UserData = mongoose.model('UserData', dataSchema);

// IMAGE MODEL
const imageSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  secureUrl: { type: String, required: true },
  publicId: { type: String, required: true },
  format: String,
  bytes: Number
}, { timestamps: true });

const Image = mongoose.model('Image', imageSchema);

// AUTHENTICATION
function createToken(user) {
  return jwt.sign(
    { email: user.email },
    JWT_SECRET,
    {
      subject: user._id.toString(),
      expiresIn: '7d'
    }
  );
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;

    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        message: 'Please log in again.'
      });
    }

    const token = header.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET);

    const user = await User.findById(decoded.sub).select('_id email name');

    if (!user) {
      return res.status(401).json({
        message: 'Account not found.'
      });
    }

    req.user = user;
    next();

  } catch (error) {
    return res.status(401).json({
      message: 'Invalid or expired login session.'
    });
  }
}

// IMAGE UPLOAD CONFIGURATION
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 1
  },
  fileFilter(req, file, callback) {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp'
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(
        new Error('Only JPG, PNG and WEBP images are allowed.')
      );
    }

    callback(null, true);
  }
});

// HOME / HEALTH CHECK
app.get('/', (req, res) => {
  res.json({
    message: 'SOLOCARE API is running.',
    status: 'OK'
  });
});

// REGISTER
app.post('/api/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !email.trim() ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        message: 'Enter valid details and a password of at least 8 characters.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({
      email: cleanEmail
    });

    if (existingUser) {
      return res.status(400).json({
        message: 'Account already exists.'
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword
    });

    await UserData.create({
      email: cleanEmail,
      data: {}
    });

    const token = createToken(newUser);

    res.status(201).json({
      message: 'Account created successfully.',
      name: newUser.name,
      token
    });

  } catch (error) {
    console.error('Registration error:', error.message);

    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Account already exists.'
      });
    }

    res.status(500).json({
      message: 'Server error during registration.'
    });
  }
});

// LOGIN
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (
      typeof email !== 'string' ||
      typeof password !== 'string'
    ) {
      return res.status(400).json({
        message: 'Enter email and password.'
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    });

    if (!user) {
      return res.status(400).json({
        message: 'Incorrect email or password.'
      });
    }

    const isMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!isMatch) {
      return res.status(400).json({
        message: 'Incorrect email or password.'
      });
    }

    const token = createToken(user);

    res.json({
      message: 'Login successful.',
      name: user.name,
      token
    });

  } catch (error) {
    console.error('Login error:', error.message);

    res.status(500).json({
      message: 'Server error during login.'
    });
  }
});

// GET USER DATA
app.post('/api/get-data', authenticate, async (req, res) => {
  try {
    const userData = await UserData.findOne({
      email: req.user.email
    });

    if (!userData) {
      return res.json({});
    }

    res.json(userData.data || {});

  } catch (error) {
    console.error('Get data error:', error.message);

    res.status(500).json({
      message: 'Server error fetching data.'
    });
  }
});

// SAVE USER DATA
app.post('/api/save-data', authenticate, async (req, res) => {
  try {
    const { data } = req.body;

    if (
      !data ||
      typeof data !== 'object' ||
      Array.isArray(data)
    ) {
      return res.status(400).json({
        message: 'Invalid data.'
      });
    }

    await UserData.findOneAndUpdate(
      { email: req.user.email },
      { $set: { data } },
      { upsert: true, new: true }
    );

    res.json({
      message: 'Data saved successfully.'
    });

  } catch (error) {
    console.error('Save data error:', error.message);

    res.status(500).json({
      message: 'Server error saving data.'
    });
  }
});

// UPLOAD IMAGE - MAXIMUM 5 MB
app.post(
  '/api/upload-image',
  authenticate,
  (req, res, next) => {
    upload.single('image')(req, res, error => {
      if (error) {
        return res.status(400).json({
          message: error.message
        });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: 'Please select an image.'
        });
      }

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'solocare',
            resource_type: 'image'
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );

        stream.end(req.file.buffer);
      });

      const savedImage = await Image.create({
        userId: req.user._id,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        format: result.format,
        bytes: result.bytes
      });

      res.status(201).json({
        message: 'Image uploaded successfully.',
        imageUrl: savedImage.secureUrl,
        imageId: savedImage._id
      });

    } catch (error) {
      console.error('Image upload error:', error.message);

      res.status(500).json({
        message: 'Image upload failed.'
      });
    }
  }
);

// ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('API error:', error.message);

  res.status(500).json({
    message: 'An unexpected server error occurred.'
  });
});

// START SERVER
app.listen(PORT, () => {
  console.log(`SOLOCARE API running on port ${PORT}`);
});
