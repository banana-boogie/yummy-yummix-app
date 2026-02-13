import React from 'react';
import { View, StyleProp, ViewStyle } from 'react-native';

interface RatingDistributionSkeletonProps {
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Skeleton placeholder for rating distribution while data is loading.
 */
export const RatingDistributionSkeleton = React.memo(function RatingDistributionSkeleton({
  className = '',
  style,
}: RatingDistributionSkeletonProps) {
  return (
    <View className={`bg-background-default rounded-lg p-md ${className}`} style={style}>
      <View className="flex-row items-center mb-md">
        <View className="mr-md">
          <View className="h-[28px] w-[48px] bg-grey-light rounded-sm mb-xs" />
          <View className="h-[12px] w-[80px] bg-grey-light rounded-sm" />
        </View>
        <View className="h-[14px] w-[120px] bg-grey-light rounded-sm" />
      </View>
      {[0, 1, 2, 3, 4].map((index) => (
        <View key={index} className="flex-row items-center mb-xs">
          <View className="w-[20px] h-[12px] bg-grey-light rounded-sm mr-xs" />
          <View className="w-[12px] h-[12px] bg-grey-light rounded-sm mr-xs" />
          <View className="flex-1 h-[8px] bg-grey-light rounded-full mr-sm" />
          <View className="w-[36px] h-[12px] bg-grey-light rounded-sm" />
        </View>
      ))}
    </View>
  );
});

export default RatingDistributionSkeleton;
