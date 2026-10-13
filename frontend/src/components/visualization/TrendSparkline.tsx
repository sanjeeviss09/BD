import React from 'react';

interface TrendSparklineProps {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}

export const TrendSparkline: React.FC<TrendSparklineProps> = ({
  data,
  color = '#0ea5e9',
  height = 36,
  width = 100,
}) => {
  if (!data || data.length < 2) {
    return <div style={{ height, width }} className="opacity-20 bg-slate-500/10 rounded" />;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min === 0 ? 1 : max - min;
  const padding = 4;
  const effectiveHeight = height - padding * 2;

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width;
      const y = height - padding - ((val - min) / range) * effectiveHeight;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const areaPoints = `${points} ${width},${height} 0,${height}`;
  const gradientId = `sparkline-grad-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  );
};
