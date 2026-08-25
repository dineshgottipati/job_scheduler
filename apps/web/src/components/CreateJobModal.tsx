import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { X, Sparkles } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  queues: any[];
}

export const CreateJobModal: React.FC<Props> = ({ isOpen, onClose, queues }) => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();

  const [queueId, setQueueId] = useState<string>(queues[0]?.id || '');
  const [name, setName] = useState<string>('send_email');
  const [payloadJson, setPayloadJson] = useState<string>('{\n  "to": "user@example.com",\n  "subject": "Hello World"\n}');
  const [idempotencyKey, setIdempotencyKey] = useState<string>('');
  const [scheduledDelaySeconds, setScheduledDelaySeconds] = useState<number>(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      let parsedPayload = {};
      try {
        parsedPayload = JSON.parse(payloadJson);
      } catch (err) {
        throw new Error('Invalid JSON payload syntax');
      }

      let scheduledAt: string | undefined = undefined;
      if (scheduledDelaySeconds > 0) {
        scheduledAt = new Date(Date.now() + scheduledDelaySeconds * 1000).toISOString();
      }

      const headers: Record<string, string> = {};
      if (idempotencyKey.trim()) {
        headers['Idempotency-Key'] = idempotencyKey.trim();
      }

      return apiFetch('/jobs', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          queueId: queueId || queues[0]?.id,
          name,
          payload: parsedPayload,
          scheduledAt
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/80 border border-white/15 backdrop-blur-2xl rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
            <span>Submit New Background Job</span>
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-950/50 border border-rose-500/30 text-rose-300 p-3 rounded-xl text-xs backdrop-blur-md">
            {errorMsg}
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setErrorMsg(null);
            createMutation.mutate();
          }}
          className="space-y-4 text-xs"
        >
          <div>
            <label className="block text-slate-400 font-medium mb-1">Target Queue</label>
            <select
              value={queueId || queues[0]?.id || ''}
              onChange={(e) => setQueueId(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
            >
              {queues.map((q) => (
                <option key={q.id} value={q.id} className="bg-slate-900 text-slate-200">
                  {q.name} {q.isPaused ? '(PAUSED)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Job Handler Type / Name</label>
            <select
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
            >
              <option value="send_email" className="bg-slate-900 text-slate-200">send_email</option>
              <option value="generate_report" className="bg-slate-900 text-slate-200">generate_report</option>
              <option value="webhook" className="bg-slate-900 text-slate-200">webhook</option>
              <option value="failing_job" className="bg-slate-900 text-slate-200">failing_job (Test Retry/DLQ)</option>
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-slate-400 font-medium">Idempotency Key (Optional)</label>
              <button
                type="button"
                onClick={() => setIdempotencyKey(`idempotent-${Date.now()}-${Math.floor(Math.random() * 1000)}`)}
                className="text-sky-400 hover:underline flex items-center space-x-1"
              >
                <Sparkles className="w-3 h-3" />
                <span>Generate Unique Key</span>
              </button>
            </div>
            <input
              type="text"
              placeholder="e.g. idempotent-key-12345"
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Execution Delay (Seconds)</label>
            <input
              type="number"
              min="0"
              placeholder="0 for immediate execution"
              value={scheduledDelaySeconds}
              onChange={(e) => setScheduledDelaySeconds(parseInt(e.target.value || '0', 10))}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">If &gt; 0, job status will be set to SCHEDULED.</p>
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Payload (JSON)</label>
            <textarea
              rows={4}
              value={payloadJson}
              onChange={(e) => setPayloadJson(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 font-mono focus:border-sky-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="px-4 py-2 bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white font-medium rounded-xl shadow-lg shadow-sky-600/20"
            >
              {createMutation.isPending ? 'Submitting...' : 'Submit Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
