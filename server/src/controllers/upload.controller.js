const { uploadFile } = require('../services/storageService');

/**
 * POST /api/upload
 * Upload a single image or video
 */
const uploadSingle = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided for upload' });
    }

    const folder = req.body.folder || 'products';
    const result = await uploadFile(req.file.buffer, req.file.originalname, req.file.mimetype, folder);

    res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      url: result.url,
      provider: result.provider,
      filename: result.filename,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/upload/multiple
 * Upload up to 10 images or videos at once
 */
const uploadMultiple = async (req, res, next) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files provided for upload' });
    }

    const folder = req.body.folder || 'products';
    const uploadPromises = req.files.map((file) =>
      uploadFile(file.buffer, file.originalname, file.mimetype, folder)
    );

    const results = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: `${results.length} files uploaded successfully`,
      urls: results.map((r) => r.url),
      files: results,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadSingle,
  uploadMultiple,
};
