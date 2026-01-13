import { supabase } from '@/lib/supabase';

interface UrlCache {
  [key: string]: {
    signedUrl: string;
    expiresAt: number;
  };
}

// Move cache outside the hook to persist between renders
const urlCache: UrlCache = {};

export function useProfileImage() {
  const getSignedUrl = async (imageUrl: string) => {
    if (!imageUrl) return null;
    
    const now = Date.now();
    const cached = urlCache[imageUrl];
    
    if (cached && cached.expiresAt > now) {
      return cached.signedUrl;
    }

    try {
      const path = imageUrl.split('user-content/')[1];
      const { data } = await supabase.storage
        .from('user-content')
        .createSignedUrl(path, 3600);

      if (data?.signedUrl) {
        urlCache[imageUrl] = {
          signedUrl: data.signedUrl,
          expiresAt: now + (50 * 60 * 1000), // 50 minutes
        };
        return data.signedUrl;
      }
    } catch (error) {
      console.error('Error getting signed URL:', error);
    }
    return null;
  };

  const deleteProfileImage = async (imageUrl: string) => {
    const urlPath = imageUrl.split('user-content/')[1];
    if (!urlPath) {
      throw new Error('Invalid file path');
    }
    await supabase.storage
      .from('user-content')
      .remove([urlPath]);
    
    // Clear cache after deletion
    delete urlCache[imageUrl];
  };

  return {
    deleteProfileImage,
    getSignedUrl,
  };
} 