import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const CreateQueueModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();

  const [name, setName] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priority, setPriority] = useState<number>(5);
  const [maxConcurrency, setMaxConcurrency] = useState<number>(5);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProject) throw new Error('No project selected');

      return apiFetch('/queues', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProject.id,
          name: name.trim(),
          description: description.trim() || undefined,
          priority,
          maxConcurrency
        })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      setName('');
      setDescription('');
      onClose();
    },
    onError: (err: any) => {
      setErrorMsg(err.message);
    }
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900/80 border border-white/15 backdrop-blur-2xl rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <h3 className="text-base font-bold text-slate-100">Create Queue</h3>
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
            <label className="block text-slate-400 font-medium mb-1">Queue Name</label>
            <input
              type="text"
              required
              placeholder="e.g. emails-high-priority"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-slate-400 font-medium mb-1">Description</label>
            <input
              type="text"
              placeholder="Queue purpose description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Default Priority</label>
              <input
                type="number"
                min="0"
                max="20"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value || '5', 10))}
                className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-slate-400 font-medium mb-1">Max Concurrency</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxConcurrency}
                onChange={(e) => setMaxConcurrency(parseInt(e.target.value || '5', 10))}
                className="w-full bg-slate-950/50 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-slate-200 focus:border-sky-500/50 focus:outline-none"
              />
            </div>
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
              {createMutation.isPending ? 'Creating...' : 'Create Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
