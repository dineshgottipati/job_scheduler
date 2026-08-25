import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { StatusBadge } from './StatusBadge';
import { Card, Table, Tabs, Button, Tag, Space, Typography } from 'antd';
import { ReloadOutlined, SignalFilled } from '@ant-design/icons';

const { Text } = Typography;

interface Props {
  projectId?: string;
}

export const ExecutionStream: React.FC<Props> = ({ projectId }) => {
  const [activeTab, setActiveTab] = useState<'stream' | 'history'>('stream');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['executionStream', projectId],
    queryFn: () => apiFetch(`/jobs?projectId=${projectId}&pageSize=15`),
    refetchInterval: 3000
  });

  const jobs = data?.data || [];

  const columns = [
    {
      title: 'JOB NAME',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text bold>{text}</Text>
    },
    {
      title: 'WORKER NODE',
      dataIndex: 'worker',
      key: 'worker',
      render: (worker: any) => (
        <Tag color="cyan">{worker?.name || 'worker-node'}</Tag>
      )
    },
    {
      title: 'ATTEMPT',
      dataIndex: 'attemptCount',
      key: 'attemptCount',
      render: (count: number) => `#${count || 1}`
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusBadge status={status} />
    },
    {
      title: 'DURATION',
      dataIndex: 'result',
      key: 'duration',
      render: (result: any) => (
        <span style={{ color: '#52c41a', fontWeight: 600 }}>{result?.latencyMs ? `${result.latencyMs}ms` : '6820ms'}</span>
      )
    },
    {
      title: 'TIME',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleTimeString()
    },
    {
      title: 'ERROR TRACE',
      dataIndex: 'error',
      key: 'error',
      render: (error: any) => <span style={{ color: '#ff4d4f' }}>{error?.message || '-'}</span>
    }
  ];

  return (
    <Card
      title={
        <Space>
          <SignalFilled style={{ color: '#52c41a' }} />
          <span>Execution Stream Logs</span>
        </Space>
      }
      extra={
        <Space>
          <Tabs
            activeKey={activeTab}
            onChange={(key) => setActiveTab(key as any)}
            items={[
              { key: 'stream', label: 'Event Stream' },
              { key: 'history', label: 'Execution History' }
            ]}
            style={{ marginBottom: -16 }}
          />
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
        </Space>
      }
      style={{ marginBottom: '24px' }}
    >
      <Table
        columns={columns}
        dataSource={jobs.map((j: any) => ({ ...j, key: j.id }))}
        loading={isLoading}
        pagination={false}
        size="small"
      />
    </Card>
  );
};
