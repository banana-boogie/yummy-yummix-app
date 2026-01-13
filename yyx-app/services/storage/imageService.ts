import { supabase } from '@/lib/supabase';
import { BaseService } from '../base/BaseService';
import { normalizeFileName } from '@/utils/formatters';
import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode } from 'base64-arraybuffer';

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
      console.error('Error in uploadImage:', error);
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
    // If it's already a File object
    if (file instanceof File) {
      if (forcePNG) {
        const blob = await this.convertToPNG(file);
        return new File([blob], file.name || 'image.png', { type: 'image/png' });
      }
      return file;
    }

    // If it's a data URL or blob URL
    if (file.uri && (file.uri.startsWith('data:') || file.uri.startsWith('blob:'))) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      if (forcePNG) {
        const pngBlob = await this.convertToPNG(blob);
        return new File([pngBlob], file.name || 'image.png', { type: 'image/png' });
      }
      return new File([blob], file.name || 'image.jpg', { type: blob.type || 'image/jpeg' });
    }

    // If it's a regular URL (like http/https)
    if (file.uri && (file.uri.startsWith('http:') || file.uri.startsWith('https:'))) {
      const response = await fetch(file.uri);
      const blob = await response.blob();
      if (forcePNG) {
        const pngBlob = await this.convertToPNG(blob);
        return new File([pngBlob], file.name || 'image.png', { type: 'image/png' });
      }
      return new File([blob], file.name || 'image.jpg', { type: blob.type || 'image/jpeg' });
    }

    throw new Error('Invalid file format for web platform');
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

  private async convertToPNG(blob: Blob): Promise<Blob> {
    // Create an image element
    const img = new Image();
    const blobUrl = URL.createObjectURL(blob);

    try {
      // Wait for the image to load
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = blobUrl;
      });

      // Create a canvas and draw the image
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');

      ctx.drawImage(img, 0, 0);

      // Convert to PNG blob
      return new Promise((resolve, reject) => {
        canvas.toBlob(
          (pngBlob) => {
            if (pngBlob) resolve(pngBlob);
            else reject(new Error('Failed to convert to PNG'));
          },
          'image/png',
          1
        );
      });
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
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