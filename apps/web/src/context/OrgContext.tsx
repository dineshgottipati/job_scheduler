import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useAuth } from './AuthContext';

interface Organization {
  id: string;
  name: string;
  slug: string;
  role?: string;
}

interface Project {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description?: string;
}

interface OrgContextType {
  organizations: Organization[];
  projects: Project[];
  selectedOrg: Organization | null;
  selectedProject: Project | null;
  setSelectedOrg: (org: Organization | null) => void;
  setSelectedProject: (proj: Project | null) => void;
  refetchOrgs: () => void;
  refetchProjects: () => void;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export const OrgProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  const { data: orgsData, refetch: refetchOrgs } = useQuery({
    queryKey: ['organizations'],
    queryFn: () => apiFetch('/organizations'),
    enabled: !!user
  });

  const organizations: Organization[] = orgsData?.organizations || [];

  useEffect(() => {
    if (organizations.length > 0 && !selectedOrg) {
      setSelectedOrg(organizations[0]);
    }
  }, [organizations, selectedOrg]);

  const { data: projData, refetch: refetchProjects } = useQuery({
    queryKey: ['projects', selectedOrg?.id],
    queryFn: () => apiFetch(`/projects?organizationId=${selectedOrg?.id}`),
    enabled: !!selectedOrg
  });

  const projects: Project[] = projData?.projects || [];

  useEffect(() => {
    if (projects.length > 0) {
      if (!selectedProject || !projects.some((p) => p.id === selectedProject.id)) {
        setSelectedProject(projects[0]);
      }
    } else {
      setSelectedProject(null);
    }
  }, [projects, selectedProject]);

  return (
    <OrgContext.Provider
      value={{
        organizations,
        projects,
        selectedOrg,
        selectedProject,
        setSelectedOrg,
        setSelectedProject,
        refetchOrgs,
        refetchProjects
      }}
    >
      {children}
    </OrgContext.Provider>
  );
};

export const useOrg = () => {
  const context = useContext(OrgContext);
  if (!context) throw new Error('useOrg must be used within OrgProvider');
  return context;
};
