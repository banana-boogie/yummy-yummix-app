import { Image } from 'expo-image';
import { cssInterop } from 'nativewind';

export function registerNativeWindInterops() {
    cssInterop(Image, {
        className: {
            target: 'style',
        },
    });
}
