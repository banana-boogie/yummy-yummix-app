import React from 'react';
import { Platform, Share, TouchableOpacity, ViewStyle } from 'react-native';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';

interface ShareButtonProps {
  message?: string;
  url: string;
  size?: number;
  className?: string; // Add className support
  style?: ViewStyle;
}

export function ShareButton({ message, url, size = 30, className = '', style }: ShareButtonProps) {

  const handleShare = async () => {
    if (Platform.OS === 'web') {
      if (typeof navigator !== 'undefined' && navigator.share) {
        try {
          await navigator.share({
            text: message,
            url,
          });
        } catch (error) {
          console.error('Web Share API error:', error);
          // Fallback to copy to clipboard
          navigator.clipboard.writeText(url);
          // You could show a toast notification here
        }
      } else if (typeof navigator !== 'undefined') {
        // Fallback for browsers that don't support Web Share API
        navigator.clipboard.writeText(url);
        // You could show a toast notification here
      }
    } else {
      // Mobile sharing
      if (await Sharing.isAvailableAsync()) {
        await Share.share({
          message: Platform.OS === 'ios' ? message || '' : `${message} ${url}`,
          url
        });
      }
    }
  };

  return (
    <TouchableOpacity
      onPress={handleShare}
      className={`p-2 ${className}`}
      style={style}
    >
      <Ionicons name="share-outline" size={size} color={COLORS.primary.MEDIUM} />
    </TouchableOpacity>
  );
}