import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOrg } from '../context/OrgContext';
import { useWebSocket } from '../context/WebSocketContext';
import { Select, Button, Tag, Avatar, Typography } from 'antd';
import {
  SafetyCertificateOutlined,
  BankOutlined,
  FolderOutlined,
  DashboardOutlined,
  AppstoreOutlined,
  PlaySquareOutlined,
  ScheduleOutlined,
  WarningOutlined,
  ClusterOutlined,
  LogoutOutlined,
  PlusOutlined,
  UserOutlined
} from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  onOpenSubmitJob?: () => void;
}

export const Navbar: React.FC<Props> = ({ onOpenSubmitJob }) => {
  const { user, logout } = useAuth();
  const { organizations, projects, selectedOrg, selectedProject, setSelectedOrg, setSelectedProject } = useOrg();
  const { isConnected } = useWebSocket();

  const navItems = [
    { label: 'Overview', path: '/', icon: <DashboardOutlined /> },
    { label: 'Queues', path: '/queues', icon: <AppstoreOutlined /> },
    { label: 'Jobs', path: '/jobs', icon: <PlaySquareOutlined /> },
    { label: 'Schedules', path: '/scheduled-jobs', icon: <ScheduleOutlined /> },
    { label: 'DLQ', path: '/dlq', icon: <WarningOutlined /> },
    { label: 'Workers', path: '/workers', icon: <ClusterOutlined /> }
  ];

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        height: '64px',
        background: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
        width: '100%'
      }}
    >
      <div
        style={{
          height: '100%',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          overflowX: 'auto',
          whiteSpace: 'nowrap'
        }}
      >
        {/* Brand & Workspace Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <NavLink to="/" style={{ display: 'flex', alignItems: 'center', gap: '8px', textDecoration: 'none' }}>
            <Avatar
              shape="square"
              size={34}
              style={{ backgroundColor: '#1677ff', flexShrink: 0 }}
              icon={<SafetyCertificateOutlined />}
            />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <Text bold style={{ color: '#0f172a', fontSize: '15px', lineHeight: 1.1 }}>
                SchedX
              </Text>
              <Text type="secondary" style={{ fontSize: '9px', letterSpacing: '0.5px' }}>
                ANT DESIGN
              </Text>
            </div>
          </NavLink>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Select
              size="small"
              style={{ width: 115 }}
              value={selectedOrg?.id || ''}
              suffixIcon={<BankOutlined />}
              onChange={(val) => {
                const org = organizations.find((o) => o.id === val);
                setSelectedOrg(org || null);
              }}
              options={organizations.map((org) => ({ label: org.name, value: org.id }))}
            />

            <Select
              size="small"
              style={{ width: 115 }}
              value={selectedProject?.id || ''}
              suffixIcon={<FolderOutlined />}
              onChange={(val) => {
                const proj = projects.find((p) => p.id === val);
                setSelectedProject(proj || null);
              }}
              options={projects.map((proj) => ({ label: proj.name, value: proj.id }))}
            />
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 1, overflowX: 'auto' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              style={({ isActive }) => ({
                color: isActive ? '#1677ff' : '#64748b',
                fontWeight: isActive ? 600 : 500,
                textDecoration: 'none',
                padding: '5px 10px',
                borderRadius: '6px',
                backgroundColor: isActive ? 'rgba(22, 119, 255, 0.08)' : 'transparent',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '13px',
                whiteSpace: 'nowrap'
              })}
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User Profile & Submit Job CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
          {isConnected ? (
            <Tag color="success" style={{ margin: 0, fontWeight: 500, fontSize: '11px' }}>
              Realtime Live
            </Tag>
          ) : (
            <Tag color="default" style={{ margin: 0, fontWeight: 500, fontSize: '11px' }}>
              Polling
            </Tag>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1677ff' }} />
            <Text style={{ color: '#0f172a', fontSize: '12px', fontWeight: 600 }}>
              {user?.name}
            </Text>
            <Button
              type="text"
              size="small"
              icon={<LogoutOutlined />}
              onClick={logout}
              style={{ color: '#64748b' }}
              title="Sign Out"
            />
          </div>

          {onOpenSubmitJob && (
            <Button
              type="primary"
              size="middle"
              icon={<PlusOutlined />}
              onClick={onOpenSubmitJob}
              style={{ borderRadius: '6px', fontWeight: 600 }}
            >
              Submit Job
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
