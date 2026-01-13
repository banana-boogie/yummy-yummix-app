import { Link, Stack } from 'expo-router';
import { View } from 'react-native';

import { Text } from '@/components/common/Text';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View className="flex-1 items-center justify-center p-[20px] bg-background-default">
        <Text preset="h1">This screen doesn't exist.</Text>
        <Link href="/" className="mt-[15px] py-[15px]">
          <Text preset="link">Go to home screen!</Text>
        </Link>
      </View>
    </>
  );
}
