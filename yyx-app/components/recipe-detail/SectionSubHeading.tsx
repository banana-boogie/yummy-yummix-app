import { StyleProp, TextStyle } from 'react-native';
import { Text } from '@/components/common/Text';

interface SectionSubHeadingProps {
  heading: string;
  className?: string;
  style?: StyleProp<TextStyle>;
}

export const SectionSubHeading: React.FC<SectionSubHeadingProps> = ({
  heading,
  className = '',
  style
}) => {
  return (
    <Text
      preset="subheading"
      className={`mb-md ${className}`}
      style={style}
    >
      {heading}
    </Text>
  );
};

