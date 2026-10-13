import React from 'react';
import { TrendSparkline } from './TrendSparkline';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface IntelligenceMetricProps {
  title: string;
  value: string | number;
  subtitle?: string;
  badge?: string;
  badgeVariant?: 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate';
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
  badgeVariant = 'cyan',
  icon,
  trend,
  sparklineData,
  sparklineColor,
  className = '',
  onClick,
}) => {
  const badgeStyles = {
    cyan: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    rose: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    slate: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  }[badgeVariant];

  const defaultColor = {
    cyan: '#0ea5e9',
    emerald: '#10b981',
    amber: '#f59e0b',
    rose: '#f43f5e',
    slate: '#94a3b8',
  }[badgeVariant];

  return (
    <div
      onClick={onClick}
      className={`group relative rounded-xl border border-slate-800 bg-slate-900/60 dark:bg-slate-900/80 light:bg-white light:border-slate-200 backdrop-blur-md p-5 shadow-lg hover:shadow-cyan-500/5 hover:border-slate-700 transition duration-200 ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-2.5">
          {icon && (
            <div className="p-2 rounded-lg bg-slate-800/80 border border-slate-700/60 text-sky-400 light:bg-slate-100 light:border-slate-200">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-xs font-medium tracking-wide uppercase text-slate-400 light:text-slate-500">
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
          <div className="opacity-80 group-hover:opacity-100 transition">
            <TrendSparkline data={sparklineData} color={sparklineColor || defaultColor} />
          </div>
        )}
      </div>

      <div className="flex items-baseline justify-between gap-2 mt-2">
        <div className="text-2xl lg:text-3xl font-bold font-sans tracking-tight text-white light:text-slate-900">
          {value}
        </div>

        {trend && (
          <div
            className={`flex items-center gap-1 text-xs font-medium ${
              trend.direction === 'up'
                ? 'text-emerald-400'
                : trend.direction === 'down'
                ? 'text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
            <span>{trend.label}</span>
          </div>
        )}
      </div>

      {subtitle && (
        <p className="mt-1.5 text-xs text-slate-400 light:text-slate-500 line-clamp-1">
          {subtitle}
        </p>
      )}
    </div>
  );
};
