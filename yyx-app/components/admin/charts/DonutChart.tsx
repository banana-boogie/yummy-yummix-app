import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  /** Format values in legend and center (e.g. for $ amounts) */
  valueFormatter?: (value: number) => string;
}

export function DonutChart({ data, size = 160, strokeWidth = 24, valueFormatter }: DonutChartProps) {
  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (!data || data.length === 0) {
    return (
      <View className="bg-white rounded-lg p-md items-center justify-center" style={{ minHeight: size }}>
        <Text preset="caption">{i18n.t('admin.analytics.noDataYet')}</Text>
      </View>
    );
  }

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Build segments: each gets a dasharray (segment length, rest) and a dashoffset (rotation)
  let cumulativeOffset = 0;
  const positiveSegments = data.filter((d) => d.value > 0);
  const segments = positiveSegments
    .map((d) => {
      const fraction = d.value / total;
      const segmentLength = fraction * circumference;
      // Only add gaps when 3+ segments so the ring is fully covered with 2
      const gap = positiveSegments.length > 2 ? 2 : 0;
      const segment = {
        color: d.color,
        dashArray: `${Math.max(segmentLength - gap, 0)} ${circumference}`,
        // Rotate: offset starts at 12 o'clock (-90deg = -circumference/4), then shift by cumulative
        dashOffset: circumference * 0.25 - cumulativeOffset,
      };
      cumulativeOffset += segmentLength;
      return segment;
    });

  return (
    <View className="bg-white rounded-lg p-md items-center">
      {/* Donut ring */}
      <View style={{ width: size, height: size, position: 'relative' }}>
        <Svg width={size} height={size}>
          {/* Background track — only visible when total is 0 */}
          {total === 0 && (
            <Circle
              cx={center}
              cy={center}
              r={radius}
              stroke={COLORS.grey.default}
              strokeWidth={strokeWidth}
              fill="none"
            />
          )}

          {/* Data segments */}
          {segments.map((seg, i) => (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={seg.dashArray}
              strokeDashoffset={seg.dashOffset}
              strokeLinecap="butt"
              fill="none"
            />
          ))}
        </Svg>

        {/* Center text */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Text preset="h3" className="text-text-default">
            {valueFormatter ? valueFormatter(total) : total.toLocaleString()}
          </Text>
          <Text preset="caption">{i18n.t('admin.analytics.total')}</Text>
        </View>
      </View>

      {/* Legend */}
      <View className="mt-md gap-xs w-full">
        {data.map((d, i) => {
          const pct = total > 0 ? Math.round((d.value / total) * 100) : 0;
          return (
            <View key={i} className="flex-row items-center gap-xs">
              <View
                style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: d.color }}
              />
              <Text preset="bodySmall" className="flex-1 text-text-default">
                {d.label}
              </Text>
              <Text preset="bodySmall" className="text-text-secondary">
                {valueFormatter ? valueFormatter(d.value) : d.value.toLocaleString()} ({pct}%)
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
