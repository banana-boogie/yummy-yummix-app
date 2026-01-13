import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform } from 'react-native';

export interface ImagePickerOptions {
  aspect?: [number, number];
  width?: number;
  allowsEditing?: boolean;
  onSuccess?: (result: {
    uri: string;
    fileObject: any;
  }) => void;
  onError?: (error: any) => void;
  onCancel?: () => void;
}

const isWeb = Platform.OS === 'web';

/**
 * A reusable function to pick and process an image from the device library
 * 
 * @param options Configuration options for the image picker
 */
export const pickImage = async (options: ImagePickerOptions = {}) => {
  const {
    aspect = [1, 1],
    width = 1200,
    allowsEditing = true,
    onSuccess,
    onError,
    onCancel
  } = options;
  
  let isLoading = true;
  
  try {
    // Request permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      if (onError) onError(new Error('Permission to access media library was denied'));
      return;
    }
    
    // Launch image picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing,
      aspect,
      quality: 1,
    });
    
    if (result.canceled) {
      if (onCancel) onCancel();
      return;
    }
    
    if (result.assets && result.assets.length > 0) {
      try {
        const originalUri = result.assets[0].uri;
        
        // For web, use the original image without manipulation
        if (isWeb) {
          const filename = originalUri.split('/').pop() || 'image.jpg';
          
          const fileToUpload = {
            uri: originalUri,
            name: filename,
            type: 'image/jpeg'
          };
          
          if (onSuccess) {
            onSuccess({
              uri: originalUri,
              fileObject: fileToUpload
            });
          }
        } else {
          // For native platforms, use image manipulation
          // Process the image to reduce file size
          const manipResult = await ImageManipulator.manipulateAsync(
            result.assets[0].uri,
            [{ resize: { width } }],
            { format: ImageManipulator.SaveFormat.JPEG, compress: 0.8 }
          );
          
          // Create a file object from the processed image
          const localUri = manipResult.uri;
          const filename = localUri.split('/').pop() || 'image.jpg';
          
          // Create file object to upload
          const fileToUpload = {
            uri: localUri,
            name: filename,
            type: 'image/jpeg'
          };
          
          if (onSuccess) {
            onSuccess({
              uri: localUri,
              fileObject: fileToUpload
            });
          }
        }
      } catch (manipulationError) {
        console.error('Image manipulation error:', manipulationError);
        
        // Fallback: use the original image if manipulation fails
        const originalUri = result.assets[0].uri;
        const filename = originalUri.split('/').pop() || 'image.jpg';
        
        const fileToUpload = {
          uri: originalUri,
          name: filename,
          type: 'image/jpeg'
        };
        
        if (onSuccess) {
          onSuccess({
            uri: originalUri,
            fileObject: fileToUpload
          });
        }
      }
    }
  } catch (error) {
    console.error('Error picking image:', error);
    if (onError) onError(error);
  } finally {
    isLoading = false;
  }
  
  return isLoading;
}; 