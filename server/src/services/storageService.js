const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { getStorage } = require('firebase-admin/storage');
const { isFirebaseReady, initFirebase } = require('../config/firebase');

// Ensure local uploads directory exists for seamless fallback
const uploadsDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/**
 * Upload a single file buffer to Firebase Cloud Storage or fallback to local disk
 * @param {Buffer} fileBuffer - The binary buffer of the file
 * @param {string} originalName - Original filename (e.g. mutton-biryani-cut.jpg)
 * @param {string} mimeType - e.g. image/jpeg, image/png, video/mp4
 * @param {string} folder - Destination subfolder (e.g. 'products', 'categories', 'banners')
 * @returns {Promise<{ success: boolean, url: string, provider: 'firebase' | 'local', filename: string }>}
 */
const uploadFile = async (fileBuffer, originalName, mimeType, folder = 'general') => {
  const ext = path.extname(originalName) || '.jpg';
  const cleanExt = ext.toLowerCase();
  const uniqueName = `${folder}/${Date.now()}-${crypto.randomBytes(6).toString('hex')}${cleanExt}`;
  const localFileName = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${cleanExt}`;

  // 1. Try uploading to Firebase Storage if available
  try {
    const firebaseApp = initFirebase();
    if (firebaseApp && isFirebaseReady()) {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET;
      const storage = getStorage(firebaseApp);
      const bucket = bucketName ? storage.bucket(bucketName) : storage.bucket();

      if (bucket && bucket.name) {
        const file = bucket.file(uniqueName);
        await file.save(fileBuffer, {
          metadata: {
            contentType: mimeType,
            cacheControl: 'public, max-age=31536000',
          },
        });

        // Make the file publicly accessible
        try {
          await file.makePublic();
        } catch (pubErr) {
          // If uniform bucket-level access is enabled, makePublic might fail
          // Generate direct public media URL
        }

        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(uniqueName)}?alt=media`;
        console.log(`[StorageService] Uploaded to Firebase Storage: ${publicUrl}`);

        return {
          success: true,
          url: publicUrl,
          provider: 'firebase',
          filename: uniqueName,
        };
      }
    }
  } catch (firebaseErr) {
    console.warn('[StorageService] Firebase Storage upload skipped/failed, using local storage fallback:', firebaseErr.message);
  }

  // 2. Fallback to Local Disk Storage (Zero downtime, works instantly without waiting for keys)
  const localFilePath = path.join(uploadsDir, localFileName);
  fs.writeFileSync(localFilePath, fileBuffer);

  const baseUrl = process.env.SERVER_URL || 'http://localhost:5000';
  const localUrl = `${baseUrl}/uploads/${localFileName}`;
  console.log(`[StorageService] Saved locally: ${localUrl}`);

  return {
    success: true,
    url: localUrl,
    provider: 'local',
    filename: localFileName,
  };
};

module.exports = {
  uploadFile,
  uploadsDir,
};
