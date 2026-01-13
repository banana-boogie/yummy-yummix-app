import { View, StyleProp, ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Image } from 'expo-image';

interface IngredientImageProps {
  source?: string | null;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

export const IngredientImage: React.FC<IngredientImageProps> = ({
  source,
  className = '',
  style
}) => {
  const [error, setError] = useState(false);

  if (!source) {
    return (
      <View
        className={`w-[70px] h-[70px] mr-md rounded-md bg-transparent items-center justify-center ${className}`}
        style={style}
      >
        <MaterialIcons name="image" size={24} color="#666" />
      </View>
    );
  }

  return (
    <View
      className={`w-[70px] h-[70px] mr-md rounded-md overflow-hidden relative ${className}`}
      style={style}
    >
      <Image
        source={source}
        className="w-full h-full"
        contentFit="cover"
        transition={300}
        cachePolicy="memory-disk"
        onError={() => setError(true)}
      />
      {error && (
        <View className="absolute inset-0 items-center justify-center">
          <MaterialIcons name="error" size={24} color="#666" />
        </View>
      )}
    </View>
  );
};
