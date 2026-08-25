import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { X, Sparkles, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface Props {
  jobId: string | null;
  onClose: () => void;
}

export const AiSummaryModal: React.FC<Props> = ({ jobId, onClose }) => {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['aiSummary', jobId],
    queryFn: () => apiFetch(`/jobs/${jobId}/ai-summary`),
    enabled: !!jobId
  });

  if (!jobId) return null;

  const ai = data?.aiSummary;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/80 border border-white/15 backdrop-blur-2xl rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-slate-100">AI Failure Diagnostic Summary</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400 space-y-3">
            <Sparkles className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs">Analyzing execution logs and exception traces...</p>
          </div>
        ) : isError ? (
          <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-4 rounded-xl text-xs backdrop-blur-md">
            Failed to generate AI summary: {(error as any)?.message}
          </div>
        ) : (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-950/50 p-4 rounded-xl border border-white/10 backdrop-blur-md">
              <p className="text-slate-300 font-medium leading-relaxed">{ai?.summary}</p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-rose-400 flex items-center space-x-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Probable Root Cause</span>
              </h4>
              <p className="bg-rose-950/30 border border-rose-500/30 p-3.5 rounded-xl text-slate-200 backdrop-blur-md">
                {ai?.rootCause}
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-semibold text-emerald-400 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4" />
                <span>Recommended Action</span>
              </h4>
              <p className="bg-emerald-950/30 border border-emerald-500/30 p-3.5 rounded-xl text-slate-200 backdrop-blur-md">
                {ai?.recommendedFix}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-white/10">
              <span>Confidence Score: {Math.round((ai?.confidenceScore || 0) * 100)}%</span>
              <span>Provider: Mock Diagnostic Intelligence</span>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-3 border-t border-white/10">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800/50 hover:bg-slate-800/80 border border-white/10 text-slate-200 font-medium rounded-xl text-xs backdrop-blur-md transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
