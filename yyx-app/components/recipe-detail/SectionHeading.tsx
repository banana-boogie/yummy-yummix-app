import { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface SectionHeadingProps {
  heading: string;
  className?: string;
  style?: StyleProp<TextStyle>;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  heading,
  className = '',
  style
}) => {
  return (
    <Text
      preset="h1"
      className={`mb-lg border-b border-grey-medium pb-sm ${className}`}
      style={style}
    >
      {heading}
    </Text>
  );
};

