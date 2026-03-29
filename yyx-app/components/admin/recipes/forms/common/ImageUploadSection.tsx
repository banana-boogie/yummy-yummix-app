import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { pickImage } from '@/utils/imageUtils';
import { Text } from '@/components/common/Text';
import { FormGroup } from '@/components/form/FormGroup';
import i18n from '@/i18n';
import logger from '@/services/logger';

interface ImageUploadSectionProps {
  imageUrl?: string;
  onImageSelected: (fileObject: any) => void;
  error?: string;
  required?: boolean;
  /** Aspect ratio for the image picker and display. Default 1 (square). Use 16/9 for recipes. */
  aspectRatio?: number;
}

export function ImageUploadSection({
  imageUrl,
  onImageSelected,
  error,
  required = false,
  aspectRatio = 1,
}: ImageUploadSectionProps) {
  const [uploading, setUploading] = useState(false);

  // Convert aspect ratio to [width, height] tuple for image picker
  const aspectTuple: [number, number] = aspectRatio >= 1
    ? [Math.round(aspectRatio * 9), 9]
    : [9, Math.round(9 / aspectRatio)];

  const handlePickImage = async () => {
    setUploading(true);

    await pickImage({
      aspect: aspectTuple,
      ...(aspectRatio !== 1 ? { width: 1200 } : {}),
      onSuccess: ({ fileObject }) => {
        onImageSelected(fileObject);
      },
      onError: (error) => {
        logger.error('Error picking image:', error);
      }
    });

    setUploading(false);
  };

  // Size: square images use w-40 h-40, wide images use constrained height
  const isWide = aspectRatio > 1.2;

  return (
    <FormGroup
      error={error}
      required={required}
    >
      <View className="items-center">
        {imageUrl ? (
          <View
            className={`relative rounded-md overflow-hidden ${isWide ? 'w-full' : 'w-40 h-40'}`}
            style={isWide ? { height: 180 } : undefined}
          >
            <Image
              source={imageUrl}
              className="w-full h-full"
              contentFit="cover"
              transition={300}
              cachePolicy="memory-disk"
            />
            <TouchableOpacity
              className="absolute bottom-0 left-0 right-0 bg-black/50 py-xs"
              onPress={handlePickImage}
              disabled={uploading}
            >
              <View className="flex-row items-center justify-center gap-xs">
                <Ionicons name="camera" size={16} color={COLORS.neutral.white} />
                <Text preset="caption" color={COLORS.neutral.white}>
                  {i18n.t('admin.common.changeImage')}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            className={`rounded-md bg-primary-light justify-center items-center border-[2px] border-primary-medium border-dashed ${isWide ? 'w-full' : 'w-40 h-40'}`}
            style={isWide ? { height: 180 } : undefined}
            onPress={handlePickImage}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={COLORS.text.secondary} />
            ) : (
              <>
                <View className="relative mb-xs">
                  <Ionicons name="image-outline" size={24} color={COLORS.text.secondary} />
                  <Ionicons
                    name="add-circle"
                    size={16}
                    color={COLORS.text.secondary}
                    className="absolute -bottom-1 -right-1"
                  />
                </View>
                <Text preset="bodySmall" className="text-text-secondary font-semibold">
                  {i18n.t('admin.common.uploadImage')}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    </FormGroup>
  );
}
