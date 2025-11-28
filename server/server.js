
// server.js
const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Create uploads directory if it doesn't exist
const uploadsRoot = path.join(__dirname, 'uploads');
const memoriesDir = path.join(uploadsRoot, 'memories');
const previewsDir = path.join(uploadsRoot, 'previews');

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const normalizeUploadPath = (filePath) => {
  if (!filePath) return null;
  const relativePath = path.relative(__dirname, filePath);
  return relativePath.split(path.sep).join('/');
};

const absoluteUploadPath = (storedPath = '') => {
  if (!storedPath) return '';
  return path.isAbsolute(storedPath) ? storedPath : path.join(__dirname, storedPath);
};

ensureDir(uploadsRoot);
ensureDir(memoriesDir);
ensureDir(previewsDir);

// MongoDB Connection
const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  console.error('Missing MONGO_URI in environment variables');
  process.exit(1);
}
mongoose.connect(mongoUri);

// Mongoose Schema
const tributeSchema = new mongoose.Schema({
  experience: {
    type: String,
    required: true
  },
  answer: {
    type: String,
    required: true
  },
  fullName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true
  },
  memoryImage: {
    type: String,
    default: null
  },
  previewImage: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Tribute = mongoose.model('Tribute', tributeSchema);

const ALLOWED_EXPERIENCES = [
  "A moment you may not remember, but I'll never forget",
  "A lesson that changed my perspective",
  "When you showed true leadership",
  "A project that made a difference"
];

const validateTributePayload = ({ experience, answer, fullName, department }) => {
  const errors = {};
  if (!experience || !experience.trim()) {
    errors.experience = 'Please select an experience to continue.';
  } 

  if (!answer || !answer.trim()) {
    errors.answer = 'Please share your memory in the answer field.';
  } else if (answer.trim().length < 40) {
    errors.answer = 'Please write at least 40 characters so we capture enough detail.';
  }

  if (!fullName || !fullName.trim()) {
    errors.fullName = 'Full name is required.';
  } else if (fullName.trim().length < 3) {
    errors.fullName = 'Please enter at least 3 characters for the name.';
  }

  if (!department || !department.trim()) {
    errors.department = 'Department is required.';
  } else if (department.trim().length < 2) {
    errors.department = 'Please enter a valid department.';
  }

  return errors;
};

const buildUploader = (folderPath) => multer({
  storage: multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, folderPath);
    },
    filename: function (req, file, cb) {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

const memoryUpload = buildUploader(memoriesDir);
const previewUpload = buildUploader(previewsDir);

// Routes

// Submit tribute
app.post('/api/submit-tribute', memoryUpload.single('image'), async (req, res) => {
  try {
    const { experience = '', answer = '', fullName = '', department = '' } = req.body;
    const trimmedPayload = {
      experience: experience.trim(),
      answer: answer.trim(),
      fullName: fullName.trim(),
      department: department.trim()
    };

    const validationErrors = validateTributePayload(trimmedPayload);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Please review the highlighted fields.',
        errors: validationErrors
      });
    }

    const tributeData = {
      ...trimmedPayload,
      memoryImage: normalizeUploadPath(req.file?.path)
    };

    const tribute = new Tribute(tributeData);
    await tribute.save();

    res.status(201).json({
      success: true,
      message: 'Tribute submitted successfully.',
      data: tribute
    });
  } catch (error) {
    console.error('Error submitting tribute:', error);
    res.status(500).json({
      success: false,
      message: 'Error submitting tribute',
      error: error.message
    });
  }
});

// Save preview image
app.post('/api/save-preview-image', previewUpload.single('image'), async (req, res) => {
  try {
    const fullName = (req.body.fullName || '').trim();

    if (!fullName) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required to match the tribute entry.',
        errors: { fullName: 'Please provide the same full name you used in the form.' }
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image provided',
        errors: { image: 'Please attach a preview image.' }
      });
    }

    // Find the most recent tribute by full name and update with preview image
    const tribute = await Tribute.findOneAndUpdate(
      { fullName },
      { previewImage: normalizeUploadPath(req.file.path) },
      { new: true, sort: { createdAt: -1 } }
    );

    if (!tribute) {
      return res.status(404).json({
        success: false,
        message: 'We could not find a tribute for that name. Please submit the form first.',
        errors: { fullName: 'No tribute found for the provided name.' }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Preview image saved successfully.',
      data: tribute
    });
  } catch (error) {
    console.error('Error saving preview image:', error);
    res.status(500).json({
      success: false,
      message: 'Error saving preview image',
      error: error.message
    });
  }
});

// Get all tributes
app.get('/api/tributes', async (req, res) => {
  try {
    const tributes = await Tribute.find().sort({ createdAt: -1 });
    res.status(200).json({
      success: true,
      count: tributes.length,
      data: tributes
    });
  } catch (error) {
    console.error('Error fetching tributes:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tributes',
      error: error.message
    });
  }
});

// Get single tribute
app.get('/api/tributes/:id', async (req, res) => {
  try {
    const tribute = await Tribute.findById(req.params.id);
    
    if (!tribute) {
      return res.status(404).json({
        success: false,
        message: 'Tribute not found'
      });
    }

    res.status(200).json({
      success: true,
      data: tribute
    });
  } catch (error) {
    console.error('Error fetching tribute:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching tribute',
      error: error.message
    });
  }
});

// Delete tribute (admin functionality)
app.delete('/api/tributes/:id', async (req, res) => {
  try {
    const tribute = await Tribute.findById(req.params.id);
    
    if (!tribute) {
      return res.status(404).json({
        success: false,
        message: 'Tribute not found'
      });
    }

    // Delete associated files
    if (tribute.memoryImage) {
      const memoryPath = absoluteUploadPath(tribute.memoryImage);
      if (fs.existsSync(memoryPath)) {
        fs.unlinkSync(memoryPath);
      }
    }
    if (tribute.previewImage) {
      const previewPath = absoluteUploadPath(tribute.previewImage);
      if (fs.existsSync(previewPath)) {
        fs.unlinkSync(previewPath);
      }
    }

    await Tribute.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Tribute deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting tribute:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting tribute',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File size is too large. Maximum size is 10MB'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    message: err.message || 'Internal server error'
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});