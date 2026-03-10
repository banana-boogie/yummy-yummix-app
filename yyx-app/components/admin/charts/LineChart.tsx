import React, { useState } from 'react';
import { View, LayoutChangeEvent, TouchableOpacity } from 'react-native';
import Svg, {
  Polyline,
  Polygon,
  Circle,
  Line,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { Text } from '@/components/common';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

export interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  lineColor?: string;
  fillColor?: string;
  /** Format values for Y-axis labels and tap tooltip (e.g. for $ amounts) */
  valueFormatter?: (value: number) => string;
}

const PAD = { top: 24, bottom: 24, left: 40, right: 10 };
const MAX_GRIDLINES = 4;
const MAX_X_LABELS = 6;
const TOOLTIP_W = 64;
const TOOLTIP_H = 22;

export function LineChart({
  data,
  height = 200,
  lineColor = COLORS.primary.dark,
  fillColor = COLORS.primary.default,
  valueFormatter,
}: LineChartProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  if (containerWidth === 0) {
    return (
      <View className="bg-white rounded-lg p-md" onLayout={handleLayout} style={{ height }} />
    );
  }

  const chartW = containerWidth - PAD.left - PAD.right;
  const chartH = height - PAD.top - PAD.bottom;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  // Round max up to a nice number for gridlines
  const niceMax = niceNumber(maxValue);

  // Map data to chart coordinates
  const points = data.map((d, i) => {
    const x = PAD.left + (data.length === 1 ? chartW / 2 : (i / (data.length - 1)) * chartW);
    const y = PAD.top + chartH - (d.value / niceMax) * chartH;
    return { x, y };
  });

  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Fill polygon: line points + bottom-right + bottom-left
  const fillPoints =
    polylinePoints +
    ` ${points[points.length - 1].x},${PAD.top + chartH}` +
    ` ${points[0].x},${PAD.top + chartH}`;

  // Gridlines — use fewer lines for small integer ranges to avoid fractional labels
  const allInteger = data.every((d) => Number.isInteger(d.value));
  const gridlineCount = allInteger && niceMax <= MAX_GRIDLINES - 1
    ? niceMax + 1   // e.g. niceMax=2 → gridlines at 0, 1, 2
    : MAX_GRIDLINES;
  const gridlines = Array.from({ length: gridlineCount }, (_, i) => {
    const value = (niceMax / (gridlineCount - 1)) * i;
    const y = PAD.top + chartH - (value / niceMax) * chartH;
    return { value, y };
  });

  const formatLabel = valueFormatter ?? formatYLabel;

  // X-axis label indices (show ~MAX_X_LABELS evenly spaced)
  const labelStep = Math.max(1, Math.ceil(data.length / MAX_X_LABELS));
  const xLabelIndices = data
    .map((_, i) => i)
    .filter((i) => i % labelStep === 0 || i === data.length - 1);

  // Hit zone size for tap targets
  const HIT_SIZE = 32;

  return (
    <View className="bg-white rounded-lg p-md" onLayout={handleLayout} style={{ position: 'relative' }}>
      <Svg width={containerWidth} height={height}>
        <Defs>
          <LinearGradient id="fillGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={fillColor} stopOpacity={0.3} />
            <Stop offset="1" stopColor={fillColor} stopOpacity={0.05} />
          </LinearGradient>
        </Defs>

        {/* Gridlines + Y-axis labels */}
        {gridlines.map((gl, i) => (
          <React.Fragment key={i}>
            <Line
              x1={PAD.left}
              y1={gl.y}
              x2={PAD.left + chartW}
              y2={gl.y}
              stroke={COLORS.grey.default}
              strokeWidth={1}
              strokeDasharray={i === 0 ? undefined : '4,4'}
            />
            <SvgText
              x={PAD.left - 6}
              y={gl.y + 4}
              fontSize={10}
              fill={COLORS.text.secondary}
              textAnchor="end"
              fontFamily="Montserrat"
            >
              {formatLabel(gl.value)}
            </SvgText>
          </React.Fragment>
        ))}

        {/* Fill area */}
        <Polygon points={fillPoints} fill="url(#fillGrad)" />

        {/* Data line */}
        <Polyline
          points={polylinePoints}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Data points */}
        {points.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={selectedIndex === i ? 5 : 3} fill={lineColor} />
        ))}

          {/* X-axis labels */}
          {xLabelIndices.map((i) => (
            <SvgText
              key={i}
              x={points[i].x}
              y={PAD.top + chartH + 16}
              fontSize={10}
              fill={COLORS.text.secondary}
              textAnchor="middle"
              fontFamily="Montserrat"
            >
              {data[i].label}
            </SvgText>
          ))}
        </Svg>

        {/* Native tap targets overlaid on each data point */}
        {points.map((p, i) => (
          <TouchableOpacity
            key={i}
            activeOpacity={0.7}
            onPress={() => setSelectedIndex(selectedIndex === i ? null : i)}
            style={{
              position: 'absolute',
              left: p.x - HIT_SIZE / 2 + 16, // +16 for p-md padding
              top: p.y - HIT_SIZE / 2 + 16,
              width: HIT_SIZE,
              height: HIT_SIZE,
            }}
          />
        ))}

        {/* Native tooltip for selected point */}
        {selectedIndex !== null && (() => {
          const p = points[selectedIndex];
          const label = formatLabel(data[selectedIndex].value);
          const tooltipLeft = Math.max(0, Math.min(p.x - TOOLTIP_W / 2, containerWidth - TOOLTIP_W));
          return (
            <View
              style={{
                position: 'absolute',
                left: tooltipLeft + 16,
                top: p.y - TOOLTIP_H - 10 + 16,
                width: TOOLTIP_W,
                height: TOOLTIP_H,
                backgroundColor: COLORS.text.default,
                borderRadius: 4,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Text preset="caption" style={{ color: 'white', fontWeight: '600', fontSize: 11 }}>
                {label}
              </Text>
            </View>
          );
        })()}
      </View>
  );
}

/** Round a number up to a "nice" integer value for axis labels */
function niceNumber(value: number): number {
  if (value <= 0) return 1;
  if (value <= 4) return Math.ceil(value / 1) * 1; // small integers: keep as-is (1-4)
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const residual = value / magnitude;
  let nice: number;
  if (residual <= 2) nice = 2;
  else if (residual <= 3) nice = 3;
  else if (residual <= 5) nice = 5;
  else nice = 10;
  return nice * magnitude;
}

function formatYLabel(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}
