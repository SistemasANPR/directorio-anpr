import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

export interface UploadResult {
  url: string;
  publicId: string;
  format: string;
  width?: number;
  height?: number;
}

export async function uploadImage(
  base64Data: string,
  folder: string = 'anpr'
): Promise<UploadResult> {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'image',
      transformation: [
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      width: result.width,
      height: result.height
    };
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    throw error;
  }
}

export async function uploadDocument(
  base64Data: string,
  folder: string = 'anpr/documents'
): Promise<UploadResult> {
  try {
    const result = await cloudinary.uploader.upload(base64Data, {
      folder,
      resource_type: 'auto'
    });

    return {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format
    };
  } catch (error) {
    console.error('Error uploading document to Cloudinary:', error);
    throw error;
  }
}

export async function deleteFile(publicId: string): Promise<boolean> {
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
}

export async function uploadFromBuffer(
  buffer: Buffer,
  folder: string = 'anpr',
  resourceType: 'image' | 'raw' | 'auto' = 'image'
): Promise<UploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        transformation: resourceType === 'image' ? [
          { quality: 'auto:good' },
          { fetch_format: 'auto' }
        ] : undefined
      },
      (error, result) => {
        if (error) {
          console.error('Error uploading to Cloudinary:', error);
          reject(error);
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            width: result.width,
            height: result.height
          });
        }
      }
    );
    uploadStream.end(buffer);
  });
}

export { cloudinary };
