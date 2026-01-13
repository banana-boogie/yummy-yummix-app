import { ImageSourcePropType } from 'react-native';

export interface FilterCategory {
  id: string;
  name: string;
  tag: string | string[];
  imageUrl: ImageSourcePropType;
}
