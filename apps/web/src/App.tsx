import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { Overview } from './pages/Overview';
import { Queues } from './pages/Queues';
import { Jobs } from './pages/Jobs';
import { ScheduledJobs } from './pages/ScheduledJobs';
import { DeadLetterQueue } from './pages/DeadLetterQueue';
import { Workers } from './pages/Workers';
import { CreateJobModal } from './components/CreateJobModal';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api/client';
import { useOrg } from './context/OrgContext';

const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading } = useAuth();
  const { selectedProject } = useOrg();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const { data: queuesData } = useQuery({
    queryKey: ['queues', selectedProject?.id],
    queryFn: () => apiFetch(`/queues?projectId=${selectedProject?.id}`),
    enabled: !!selectedProject
  });

  const queues = queuesData?.queues || [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        Loading session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      <Navbar onOpenSubmitJob={() => setIsSubmitModalOpen(true)} />

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {children}
      </main>

      <CreateJobModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        queues={queues}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/"
        element={
          <ProtectedLayout>
            <Overview />
          </ProtectedLayout>
        }
      />
      <Route
        path="/queues"
        element={
          <ProtectedLayout>
            <Queues />
          </ProtectedLayout>
        }
      />
      <Route
        path="/jobs"
        element={
          <ProtectedLayout>
            <Jobs />
          </ProtectedLayout>
        }
      />
      <Route
        path="/scheduled-jobs"
        element={
          <ProtectedLayout>
            <ScheduledJobs />
          </ProtectedLayout>
        }
      />
      <Route
        path="/dlq"
        element={
          <ProtectedLayout>
            <DeadLetterQueue />
          </ProtectedLayout>
        }
      />
      <Route
        path="/workers"
        element={
          <ProtectedLayout>
            <Workers />
          </ProtectedLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
