import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { StatusBadge } from '../components/StatusBadge';
import { JsonViewer } from '../components/JsonViewer';
import { AiSummaryModal } from '../components/AiSummaryModal';
import { Card, Table, Button, Space, Tag, Typography } from 'antd';
import { WarningOutlined, RotateLeftOutlined, ExperimentOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export const DeadLetterQueue: React.FC = () => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();
  const [aiSummaryJobId, setAiSummaryJobId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['dlq', selectedProject?.id],
    queryFn: () => apiFetch('/dlq')
  });

  const dlqEntries = data?.dlqEntries || [];

  const retryMutation = useMutation({
    mutationFn: (dlqId: string) => apiFetch(`/dlq/${dlqId}/retry`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dlq'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    }
  });

  const resolveMutation = useMutation({
    mutationFn: (dlqId: string) => apiFetch(`/dlq/${dlqId}/resolve`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['dlq'] })
  });

  const columns = [
    {
      title: 'JOB NAME',
      dataIndex: 'job',
      key: 'name',
      render: (job: any) => <Text bold>{job?.name || 'Failed Job'}</Text>
    },
    {
      title: 'STATUS',
      key: 'status',
      render: (_: any, record: any) => (
        <Space>
          <StatusBadge status="DEAD_LETTER" />
          {record.isResolved && <Tag color="success">RESOLVED</Tag>}
        </Space>
      )
    },
    {
      title: 'FAILURE REASON',
      dataIndex: 'reason',
      key: 'reason',
      render: (reason: string) => <Text type="danger" style={{ fontSize: '11px' }}>{reason}</Text>
    },
    {
      title: 'FAILED AT',
      dataIndex: 'failedAt',
      key: 'failedAt',
      render: (date: string) => new Date(date).toLocaleString()
    },
    {
      title: 'ACTIONS',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="small">
          <Button
            size="small"
            icon={<ExperimentOutlined />}
            onClick={() => setAiSummaryJobId(record.jobId)}
          >
            AI Diagnosis
          </Button>

          <Button
            size="small"
            type="primary"
            icon={<RotateLeftOutlined />}
            loading={retryMutation.isPending}
            onClick={() => retryMutation.mutate(record.id)}
          >
            Retry
          </Button>

          {!record.isResolved && (
            <Button
              size="small"
              icon={<CheckOutlined />}
              onClick={() => resolveMutation.mutate(record.id)}
            >
              Mark Resolved
            </Button>
          )}
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Dead Letter Queue (DLQ) Explorer
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Permanently failed jobs that exhausted maximum retry attempts
            </Text>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Refresh
          </Button>
        </div>
      </Card>

      <Card title="Failed Job Entries">
        <Table
          columns={columns}
          dataSource={dlqEntries.map((entry: any) => ({ ...entry, key: entry.id }))}
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      <AiSummaryModal jobId={aiSummaryJobId} onClose={() => setAiSummaryJobId(null)} />
    </div>
  );
};
