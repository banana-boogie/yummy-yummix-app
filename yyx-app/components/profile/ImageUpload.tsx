import React, { useState, useEffect } from 'react';
import { View, TouchableOpacity, ActivityIndicator, ViewStyle, StyleProp } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import { Text } from '@/components/common/Text';

import { useProfileImage } from '@/hooks/useProfileImage';
import { Ionicons } from '@expo/vector-icons';

interface Props {
  url: string | null | undefined;
  onUpload?: (url: string) => Promise<void>;
  onDelete?: () => Promise<void>;
  fileName?: string;
  showDeleteButton?: boolean;
  readonly?: boolean;
  className?: string; // Add className
  style?: StyleProp<ViewStyle>;
  buttonClassName?: string; // Add buttonClassName
  buttonStyle?: StyleProp<ViewStyle>;
  deleteButtonClassName?: string; // Add deleteButtonClassName
  deleteButtonStyle?: StyleProp<ViewStyle>;
  caption?: string;
}

export default function ImageUpload(props: Props) {
  const { url, onUpload, onDelete, fileName, showDeleteButton = false, readonly = false, className = '', style, buttonClassName = '', buttonStyle, deleteButtonClassName = '', deleteButtonStyle, caption } = props;
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const { getSignedUrl } = useProfileImage();

  useEffect(() => {
    async function fetchSignedUrl() {
      if (url) {
        setLoading(true);
        try {
          const signed = await getSignedUrl(url);
          setSignedUrl(signed);
        } catch (error) {
          console.error('Error fetching signed URL:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setSignedUrl(null);
      }
    }
    fetchSignedUrl();
  }, [url]);

  const handleDelete = async () => {
    if (onDelete) {
      await onDelete();
      setSignedUrl(null);  // Clear signedUrl after deletion
    }
  };

  async function upload() {
    try {
      setUploading(true);

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.[0]?.uri) return;

      // Compress image
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 500, height: 500 } }],
        {
          compress: 0.7,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true,
        }
      );

      if (!compressed.base64) return;

      const filePath = `profile-images/${fileName || 'default'}.jpeg`;

      const { error: uploadError } = await supabase.storage
        .from('user-content')
        .upload(filePath, decode(compressed.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('user-content')
        .getPublicUrl(filePath);

      await onUpload?.(publicUrl);
    } catch (error) {
      console.error('Error uploading image:', error);
    } finally {
      setUploading(false);
    }
  }

  return (
    <View className={`items-center ${className}`} style={style}>
      {(uploading || loading) ? (
        <View className="w-[120px] h-[120px] rounded-[60px] bg-grey-light justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <View>
          {readonly ? (
            <View className={`w-[120px] h-[120px] ${buttonClassName}`} style={buttonStyle}>
              <Image
                source={
                  signedUrl
                    ? signedUrl
                    : require('@/assets/images/user-profile/user-profile-placeholder.png')
                }
                className="w-full h-full rounded-full"
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
            </View>
          ) : (
            <TouchableOpacity onPress={upload} className={`w-[120px] h-[120px] ${buttonClassName}`} style={buttonStyle}>
              <Image
                source={
                  signedUrl
                    ? signedUrl
                    : require('@/assets/images/user-profile/user-profile-placeholder.png')
                }
                className="w-full h-full rounded-full"
                contentFit="cover"
                transition={300}
                cachePolicy="memory-disk"
              />
              {caption && (
                <Text preset="caption" className="mt-xxs text-center text-xs">
                  {caption}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {showDeleteButton && url && onDelete && !readonly && (
            <TouchableOpacity
              className={`bg-status-error p-2 rounded-[16px] absolute top-[-12px] right-[-20px] w-8 h-8 z-1 ${deleteButtonClassName}`}
              style={deleteButtonStyle}
              onPress={handleDelete}
            >
              <Ionicons name="close" size={16} color="white" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}