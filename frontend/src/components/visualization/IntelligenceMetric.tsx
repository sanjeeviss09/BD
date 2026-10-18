import React from 'react';
import { TrendSparkline } from './TrendSparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface IntelligenceMetricProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'mono';
  icon?: React.ReactNode;
  trend?: {
    direction: 'up' | 'down' | 'neutral';
    label: string;
  };
  sparklineData?: number[];
  sparklineColor?: string;
  className?: string;
  onClick?: () => void;
}

export const IntelligenceMetric: React.FC<IntelligenceMetricProps> = ({
  title,
  value,
  subtitle,
  badge,
  badgeVariant = 'mono',
  icon,
  trend,
  sparklineData,
  sparklineColor,
  className = '',
  onClick,
}) => {
  const badgeStyles = {
    mono: 'bg-muted text-foreground border-border',
    cyan: 'bg-muted text-foreground border-border',
    emerald: 'bg-muted text-foreground border-border',
    amber: 'bg-muted text-foreground border-border',
    rose: 'bg-muted text-foreground border-border',
    slate: 'bg-muted text-muted-foreground border-border',
  }[badgeVariant];

  const defaultColor = '#ffffff';

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`group relative rounded-xl border border-border bg-card/90 backdrop-blur-md p-5 shadow-xs hover:border-foreground/30 hover:shadow-md transition-all duration-200 select-none ${
        onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-2 rounded-lg bg-muted border border-border text-foreground shrink-0">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
              {title}
            </h3>
            {badge && (
              <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${badgeStyles}`}>
                {badge}
              </span>
            )}
          </div>
        </div>

        {sparklineData && (
          <div className="opacity-70 group-hover:opacity-100 transition">
            <TrendSparkline data={sparklineData} color={sparklineColor || defaultColor} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-2">
        <div className="text-2xl lg:text-3xl font-bold font-mono tracking-tight text-foreground">
          {value}
        </div>

        {trend && (
          <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
            <span>{trend.label}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-muted-foreground line-clamp-1 font-mono">
          {subtitle}
        </p>
      )}
    </div>
  );
};
