import React, { useState } from 'react';
import { View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { pickImage } from '@/utils/imageUtils';
import { Text } from '@/components/common/Text';
import { FormSection } from '@/components/form/FormSection';
import { FormGroup } from '@/components/form/FormGroup';
import i18n from '@/i18n';
import logger from '@/services/logger';

interface ImageUploadSectionProps {
  imageUrl?: string;
  onImageSelected: (fileObject: any) => void;
  error?: string;
  required?: boolean;
  title?: string;
}

export function ImageUploadSection({
  imageUrl,
  onImageSelected,
  error,
  required = false,
  title
}: ImageUploadSectionProps) {
  const [uploading, setUploading] = useState(false);

  const handlePickImage = async () => {
    setUploading(true);

    await pickImage({
      aspect: [1, 1],
      onSuccess: ({ fileObject }) => {
        onImageSelected(fileObject);
      },
      onError: (error) => {
        logger.error('Error picking image:', error);
      }
    });

    setUploading(false);
  };

  return (
    <FormSection title={title}>
      <FormGroup
        error={error}
        required={required}
      >
        <View className="items-center">
          {imageUrl ? (
            <View className="relative w-40 h-40 rounded-md overflow-hidden">
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
              className="w-40 h-40 rounded-md bg-primary-light justify-center items-center border-[2px] border-primary-medium border-dashed"
              onPress={handlePickImage}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={COLORS.neutral.white} />
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
    </FormSection>
  );
}
