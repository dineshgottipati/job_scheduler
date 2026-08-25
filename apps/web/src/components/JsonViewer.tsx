import React from 'react';

interface Props {
  data: any;
  title?: string;
}

export const JsonViewer: React.FC<Props> = ({ data, title }) => {
  if (!data || (typeof data === 'object' && Object.keys(data).length === 0)) {
    return <span className="text-slate-500 italic text-sm">None</span>;
  }

  return (
    <div className="space-y-1">
      {title && <p className="text-xs font-semibold text-slate-400 uppercase">{title}</p>}
      <pre className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs font-mono text-emerald-400 overflow-x-auto max-h-60">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};
