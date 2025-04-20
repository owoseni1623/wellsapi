const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const writeFileAsync = promisify(fs.writeFile);
const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

// Base directory for uploads
const UPLOAD_DIR = path.join(__dirname, '../uploads');

// Ensure upload directory exists
const ensureDirectoryExists = async (directory) => {
  try {
    await mkdirAsync(directory, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
};

// Upload image from multer file or base64 string
exports.uploadImage = async (file, filename) => {
  try {
    // Create directory if it doesn't exist
    const dirPath = path.join(UPLOAD_DIR, path.dirname(filename));
    await ensureDirectoryExists(dirPath);
    
    let filePath = '';
    
    if (typeof file === 'string' && file.startsWith('data:image')) {
      // Handle base64 encoded image
      const matches = file.match(/^data:image\/([A-Za-z-+/]+);base64,(.+)$/);
      
      if (!matches || matches.length !== 3) {
        throw new Error('Invalid base64 image format');
      }
      
      const extension = matches[1].replace('+', '');
      const imageData = Buffer.from(matches[2], 'base64');
      
      // Create full path with extension
      filePath = `${filename}.${extension}`;
      const fullPath = path.join(UPLOAD_DIR, filePath);
      
      // Write file
      await writeFileAsync(fullPath, imageData);
    } else if (file && file.path) {
      // Handle multer file
      const extension = path.extname(file.originalname);
      filePath = `${filename}${extension}`;
      const fullPath = path.join(UPLOAD_DIR, filePath);
      
      // Move file from temp location to final destination
      const fileData = fs.readFileSync(file.path);
      await writeFileAsync(fullPath, fileData);
      
      // Remove temp file
      await unlinkAsync(file.path);
    } else {
      throw new Error('Invalid file type');
    }
    
    return filePath;
  } catch (error) {
    console.error('Error uploading image:', error);
    throw new Error('Failed to upload image');
  }
};

// Delete an uploaded image
exports.deleteImage = async (filePath) => {
  try {
    const fullPath = path.join(UPLOAD_DIR, filePath);
    
    // Check if file exists
    if (fs.existsSync(fullPath)) {
      await unlinkAsync(fullPath);
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    throw new Error('Failed to delete image');
  }
};