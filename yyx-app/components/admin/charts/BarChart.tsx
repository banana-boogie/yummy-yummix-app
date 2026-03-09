import React, { useState } from 'react';
import { View, LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export interface BarChartProps {
  data: { label: string; values: { value: number; color: string }[] }[];
  height?: number;
  showLabels?: boolean;
  horizontal?: boolean;
}

const VERTICAL_PADDING = { top: 20, bottom: 28, left: 10, right: 10 };
const HORIZONTAL_PADDING = { top: 10, bottom: 10, left: 80, right: 40 };

export function BarChart({
  data,
  height = 200,
  showLabels = true,
  horizontal = false,
}: BarChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    setContainerWidth(e.nativeEvent.layout.width);
  };

  if (!data || data.length === 0) {
    return (
      <View className="bg-white rounded-lg p-md items-center justify-center" style={{ height }}>
        <Text preset="caption">{i18n.t('admin.analytics.noDataYet')}</Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => d.values.map((v) => v.value)), 1);

  if (containerWidth === 0) {
    return (
      <View className="bg-white rounded-lg p-md" onLayout={handleLayout} style={{ height }} />
    );
  }

  if (horizontal) {
    return renderHorizontal(data, containerWidth, height, maxValue, showLabels, handleLayout);
  }

  return renderVertical(data, containerWidth, height, maxValue, showLabels, handleLayout);
}

function renderVertical(
  data: BarChartProps['data'],
  containerWidth: number,
  height: number,
  maxValue: number,
  showLabels: boolean,
  handleLayout: (e: LayoutChangeEvent) => void,
) {
  const pad = VERTICAL_PADDING;
  const chartW = containerWidth - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const groupCount = data.length;
  const barsPerGroup = data[0]?.values.length ?? 1;

  // Proportional spacing
  const groupGap = Math.max(chartW * 0.04, 4);
  const barGap = Math.max(chartW * 0.01, 2);
  const totalGroupGaps = (groupCount - 1) * groupGap;
  const groupWidth = (chartW - totalGroupGaps) / groupCount;
  const totalBarGaps = (barsPerGroup - 1) * barGap;
  const barWidth = Math.min((groupWidth - totalBarGaps) / barsPerGroup, 40);

  // Center bars within group
  const actualGroupContentWidth = barWidth * barsPerGroup + totalBarGaps;

  return (
    <View className="bg-white rounded-lg p-md" onLayout={handleLayout}>
      <Svg width={containerWidth} height={height}>
        {/* Baseline */}
        <Line
          x1={pad.left}
          y1={pad.top + chartH}
          x2={pad.left + chartW}
          y2={pad.top + chartH}
          stroke={COLORS.grey.default}
          strokeWidth={1}
        />

        {data.map((group, gi) => {
          const groupX = pad.left + gi * (groupWidth + groupGap);
          const offsetX = groupX + (groupWidth - actualGroupContentWidth) / 2;

          return (
            <React.Fragment key={gi}>
              {group.values.map((v, vi) => {
                const barH = maxValue > 0 ? (v.value / maxValue) * chartH : 0;
                const x = offsetX + vi * (barWidth + barGap);
                const y = pad.top + chartH - barH;

                return (
                  <React.Fragment key={vi}>
                    <Rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={Math.max(barH, 1)}
                      rx={3}
                      fill={v.color}
                    />
                    {/* Value text above bar */}
                    <SvgText
                      x={x + barWidth / 2}
                      y={y - 4}
                      fontSize={10}
                      fill={COLORS.text.secondary}
                      textAnchor="middle"
                      fontFamily="Montserrat"
                    >
                      {formatNumber(v.value)}
                    </SvgText>
                  </React.Fragment>
                );
              })}

              {/* Label below group */}
              {showLabels && (
                <SvgText
                  x={groupX + groupWidth / 2}
                  y={pad.top + chartH + 16}
                  fontSize={10}
                  fill={COLORS.text.secondary}
                  textAnchor="middle"
                  fontFamily="Montserrat"
                >
                  {truncateLabel(group.label, 8)}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function renderHorizontal(
  data: BarChartProps['data'],
  containerWidth: number,
  height: number,
  maxValue: number,
  showLabels: boolean,
  handleLayout: (e: LayoutChangeEvent) => void,
) {
  const pad = HORIZONTAL_PADDING;
  const chartW = containerWidth - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const groupCount = data.length;
  const barsPerGroup = data[0]?.values.length ?? 1;

  const groupGap = Math.max(chartH * 0.04, 4);
  const barGap = Math.max(chartH * 0.01, 2);
  const totalGroupGaps = (groupCount - 1) * groupGap;
  const groupHeight = (chartH - totalGroupGaps) / groupCount;
  const totalBarGaps = (barsPerGroup - 1) * barGap;
  const barHeight = Math.min((groupHeight - totalBarGaps) / barsPerGroup, 28);

  const actualGroupContentHeight = barHeight * barsPerGroup + totalBarGaps;

  return (
    <View className="bg-white rounded-lg p-md" onLayout={handleLayout}>
      <Svg width={containerWidth} height={height}>
        {data.map((group, gi) => {
          const groupY = pad.top + gi * (groupHeight + groupGap);
          const offsetY = groupY + (groupHeight - actualGroupContentHeight) / 2;

          return (
            <React.Fragment key={gi}>
              {/* Label to the left */}
              {showLabels && (
                <SvgText
                  x={pad.left - 8}
                  y={groupY + groupHeight / 2 + 4}
                  fontSize={11}
                  fill={COLORS.text.default}
                  textAnchor="end"
                  fontFamily="Montserrat"
                >
                  {truncateLabel(group.label, 10)}
                </SvgText>
              )}

              {group.values.map((v, vi) => {
                const barW = maxValue > 0 ? (v.value / maxValue) * chartW : 0;
                const y = offsetY + vi * (barHeight + barGap);

                return (
                  <React.Fragment key={vi}>
                    <Rect
                      x={pad.left}
                      y={y}
                      width={Math.max(barW, 1)}
                      height={barHeight}
                      rx={3}
                      fill={v.color}
                    />
                    {/* Value text to the right of bar */}
                    <SvgText
                      x={pad.left + barW + 6}
                      y={y + barHeight / 2 + 4}
                      fontSize={10}
                      fill={COLORS.text.secondary}
                      fontFamily="Montserrat"
                    >
                      {formatNumber(v.value)}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

function formatNumber(n: number): string {
  if (n >= 1000) return n.toLocaleString();
  return String(n);
}

function truncateLabel(label: string, maxLen: number): string {
  if (label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + '\u2026';
}
