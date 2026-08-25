import React from 'react';
import { LucideIcon } from 'lucide-react';

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  color?: 'blue' | 'emerald' | 'amber' | 'rose' | 'purple';
}

export const StatsCard: React.FC<Props> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  color = 'blue'
}) => {
  const colorMap = {
    blue: 'bg-sky-500/15 text-sky-300 border-sky-500/30 shadow-sky-500/10',
    emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 shadow-emerald-500/10',
    amber: 'bg-amber-500/15 text-amber-300 border-amber-500/30 shadow-amber-500/10',
    rose: 'bg-rose-500/15 text-rose-300 border-rose-500/30 shadow-rose-500/10',
    purple: 'bg-purple-500/15 text-purple-300 border-purple-500/30 shadow-purple-500/10'
  };

  return (
    <div className="bg-slate-900/40 border border-white/10 backdrop-blur-xl rounded-2xl p-5 shadow-xl shadow-black/30 hover:border-white/20 transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold text-slate-100 mt-1.5 tracking-tight">{value}</p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3.5 rounded-xl border ${colorMap[color]} shadow-lg`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
};
