import { View, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image } from 'expo-image';

interface RecipeImageProps {
  pictureUrl?: string | null;
  className?: string;
  style?: StyleProp<ViewStyle>;
  width?: number | string;  // Allow percentage strings
  height?: number;
  aspectRatio?: number;
  maxWidth?: number;
}

export const RecipeImage: React.FC<RecipeImageProps> = ({
  pictureUrl,
  className = '',
  style,
  width: propWidth,
  height: propHeight,
  aspectRatio,
  maxWidth = 1200
}) => {
  const [error, setError] = useState(false);
  const { width: screenWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState(0);

  // Calculate optimal image dimensions based on provided props
  const getImageDimensions = () => {
    let width = typeof propWidth === 'number'
      ? propWidth
      : containerWidth;  // Use measured container width
    width = Math.min(width, maxWidth, screenWidth);

    let height = propHeight;
    if (!height && aspectRatio) {
      height = Math.round(width / aspectRatio);
    } else if (!height) {
      height = Math.round(width * 0.66); // Default 3:2 aspect ratio
    }

    return {
      width,
      height,
    };
  };

  const { width, height } = getImageDimensions();

  if (!pictureUrl) {
    return (
      <View
        className={`items-center justify-center bg-grey-light ${className}`}
        style={[{ height }, style]}
      >
        <MaterialIcons name="image" size={32} color="#666" />
      </View>
    );
  }

  return (
    <View
      className={`relative ${className}`}
      style={[{ height, width: propWidth as any }, style]}
      onLayout={(event) => {
        setContainerWidth(event.nativeEvent.layout.width);
      }}
    >
      <Image
        source={pictureUrl}
        style={{ height, width }}
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
        onError={() => setError(true)}
      />
      {error && (
        <View
          className="absolute top-0 left-0 right-0 items-center justify-center"
          style={{ height }}
        >
          <MaterialIcons name="error" size={32} color="#666" />
        </View>
      )}
    </View>
  );
};