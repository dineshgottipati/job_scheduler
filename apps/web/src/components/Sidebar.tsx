import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Layers, PlaySquare, CalendarClock, AlertOctagon, Cpu } from 'lucide-react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Overview', path: '/', icon: LayoutDashboard },
    { label: 'Queues', path: '/queues', icon: Layers },
    { label: 'Job Explorer', path: '/jobs', icon: PlaySquare },
    { label: 'Scheduled Cron', path: '/scheduled-jobs', icon: CalendarClock },
    { label: 'Dead Letter Queue', path: '/dlq', icon: AlertOctagon },
    { label: 'Workers Cluster', path: '/workers', icon: Cpu }
  ];

  return (
    <aside className="w-64 bg-slate-900/30 border-r border-white/10 backdrop-blur-xl p-4 space-y-6 flex-shrink-0 z-20">
      <nav className="space-y-1.5">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-sky-500/15 text-sky-300 border border-sky-500/30 backdrop-blur-md shadow-lg shadow-sky-500/10 font-semibold'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 hover:border hover:border-white/10'
              }`
            }
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
