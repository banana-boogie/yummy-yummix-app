import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { normalizeFileName } from '@/utils/formatters';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';
import logger from '@/services/logger';

/** Max file size for image uploads (2MB — matches Supabase bucket config) */
const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_IMAGE_SIZE_MB = 2;

interface UploadImageProps {
  bucket: string;
  folderPath: string;
  fileName: string;
  file: any; // Can be File or { uri: string, type: string, name: string }
  forcePNG?: boolean; // New parameter to control PNG conversion
}

export class ImageService extends BaseService {
  constructor() {
    super(supabase);
  }

  async uploadImage({ bucket, folderPath, fileName, file, forcePNG = false }: UploadImageProps): Promise<string> {
    try {
      // Add timestamp to filename before normalization
      const timestamp = Date.now();

      // Properly handle file name and extension
      const nameWithoutExt = fileName.replace(/\..*$/, ''); // Remove any extension
      const extension = forcePNG ? 'png' : (file.type?.split('/')[1] || 'jpg');
      const timestampedName = `${nameWithoutExt}_${timestamp}.${extension}`;
      const normalizedFileName = normalizeFileName(timestampedName).replace(new RegExp(`_${extension}$`), `.${extension}`);
      const fullPath = `${folderPath}/${normalizedFileName}`;

      // Process the file based on platform
      const processedFile = await this.processFile(file, forcePNG);

      // Validate file size before upload
      if (processedFile.size > MAX_IMAGE_SIZE_BYTES) {
        const sizeMB = (processedFile.size / (1024 * 1024)).toFixed(1);
        throw new Error(
          `Image is too large (${sizeMB}MB). Maximum size is ${MAX_IMAGE_SIZE_MB}MB. Please use a smaller image.`
        );
      }

      const { error } = await this.supabase.storage
        .from(bucket)
        .upload(fullPath, processedFile);

      if (error) {
        throw new Error(`Failed to upload image: ${error.message}`);
      }

      const { data } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(fullPath);

      return data.publicUrl;
    } catch (error) {
      logger.error('Error in uploadImage:', error);
      // Preserve the original error message so callers can show useful feedback
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to upload image. Please try again.');
    }
  }

  private async processFile(file: any, forcePNG: boolean): Promise<File> {
    if (Platform.OS === 'web') {
      return this.processWebFile(file, forcePNG);
    }
    return this.processMobileFile(file, forcePNG);
  }

  private async processWebFile(file: any, forcePNG: boolean): Promise<File> {
    let blob: Blob;

    if (file instanceof File) {
      blob = file;
    } else if (file.uri) {
      const response = await fetch(file.uri);
      blob = await response.blob();
    } else {
      throw new Error('Invalid file format for web platform');
    }

    // Resize and optionally convert format (matches mobile behavior)
    const resized = await this.resizeWebImage(blob, 1200, forcePNG);
    const ext = forcePNG ? 'png' : 'jpg';
    const mime = forcePNG ? 'image/png' : 'image/jpeg';
    return new File([resized], file.name || `image.${ext}`, { type: mime });
  }

  /** Resize a web image to maxWidth, optionally converting to PNG */
  private async resizeWebImage(blob: Blob, maxWidth: number, asPNG: boolean): Promise<Blob> {
    const img = new Image();
    const blobUrl = URL.createObjectURL(blob);

    try {
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = blobUrl;
      });

      // Only downscale, never upscale
      const scale = img.width > maxWidth ? maxWidth / img.width : 1;
      const width = Math.round(img.width * scale);
      const height = Math.round(img.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(img, 0, 0, width, height);

      const format = asPNG ? 'image/png' : 'image/jpeg';
      const quality = 1;

      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (result) => {
            if (result) resolve(result);
            else reject(new Error('Failed to resize image'));
          },
          format,
          quality,
        );
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  private async processMobileFile(file: any, forcePNG: boolean): Promise<File> {
    // Process mobile image with ImageManipulator
    const manipResult = await ImageManipulator.manipulateAsync(
      file.uri,
      [{ resize: { width: 1200 } }],
      {
        format: forcePNG ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
        compress: 0.8,
        base64: true
      }
    );

    if (!manipResult.base64) {
      throw new Error('Failed to process image');
    }

    // Convert the processed image to a File object
    const arrayBuffer = decode(manipResult.base64);
    const mimeType = forcePNG ? 'image/png' : 'image/jpeg';
    const extension = forcePNG ? 'png' : 'jpg';
    const blob = new Blob([arrayBuffer], { type: mimeType });
    return new File([blob], `image.${extension}`, { type: mimeType });
  }

  async deleteImage(imageUrl: string): Promise<void> {
    if (!imageUrl) {
      throw new Error('No image URL provided');
    }

    try {
      // Parse the URL to extract bucket and path
      const url = new URL(imageUrl);

      // Extract path from Supabase storage URL
      // Format: https://[project-ref].supabase.co/storage/v1/object/public/[bucket]/[path]
      const storagePathRegex = /\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/;
      const match = url.pathname.match(storagePathRegex);

      if (!match) {
        throw new Error(`Invalid Supabase storage URL format: ${imageUrl}`);
      }

      const [, bucket, path] = match;

      if (!bucket || !path) {
        throw new Error(`Could not extract bucket and path from URL: ${imageUrl}`);
      }

      const { error } = await this.supabase.storage
        .from(bucket)
        .remove([path]);

      if (error) {
        throw new Error(`Failed to delete image: ${error.message}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Failed to delete image: ${error}`);
      }
    }
  }
}

export const imageService = new ImageService();
export default imageService; 