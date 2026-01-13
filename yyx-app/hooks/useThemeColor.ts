/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useColorScheme } from 'react-native';

import { COLORS } from '@/constants';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: string
) {
  const theme = useColorScheme() ?? 'light';
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  }

  const keys = colorName.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let result: any = COLORS;
  for (const key of keys) {
    result = result?.[key];
  }
  return result as string;
}
