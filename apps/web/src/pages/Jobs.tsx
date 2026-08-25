import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { StatusBadge } from '../components/StatusBadge';
import { JsonViewer } from '../components/JsonViewer';
import { JobDispatcher } from '../components/JobDispatcher';
import { ExecutionStream } from '../components/ExecutionStream';
import { AiSummaryModal } from '../components/AiSummaryModal';
import { Card, Table, Input, Drawer, Button, Space, Typography, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined, RotateLeftOutlined, ExperimentOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export const Jobs: React.FC = () => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [aiSummaryJobId, setAiSummaryJobId] = useState<string | null>(null);

  const { data: queuesData } = useQuery({
    queryKey: ['queues', selectedProject?.id],
    queryFn: () => apiFetch(`/queues?projectId=${selectedProject?.id}`),
    enabled: !!selectedProject
  });

  const queues = queuesData?.queues || [];

  const { data: jobsData, isLoading, refetch } = useQuery({
    queryKey: ['jobs', selectedProject?.id, page, statusFilter, searchQuery],
    queryFn: () => {
      let url = `/jobs?projectId=${selectedProject?.id}&page=${page}&pageSize=15`;
      if (statusFilter) url += `&status=${statusFilter}`;
      if (searchQuery) url += `&search=${encodeURIComponent(searchQuery)}`;
      return apiFetch(url);
    },
    enabled: !!selectedProject
  });

  const jobs = jobsData?.data || [];
  const meta = jobsData?.meta || { page: 1, totalPages: 1, total: 0 };

  const filterTabs = [
    { label: 'ALL', value: '' },
    { label: 'QUEUED', value: 'QUEUED' },
    { label: 'RUNNING', value: 'RUNNING' },
    { label: 'COMPLETED', value: 'COMPLETED' },
    { label: 'FAILED', value: 'FAILED' },
    { label: 'DEAD LETTER', value: 'DEAD_LETTER' }
  ];

  const columns = [
    {
      title: 'JOB NAME',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text bold>{name}</Text>
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusBadge status={status} />
    },
    {
      title: 'TARGET QUEUE',
      dataIndex: 'queueName',
      key: 'queueName',
      render: (q: string) => <Tag color="cyan">{q}</Tag>
    },
    {
      title: 'ATTEMPTS',
      dataIndex: 'attemptCount',
      key: 'attempts',
      render: (_: any, record: any) => `${record.attemptCount} / ${record.maxAttempts}`
    },
    {
      title: 'RUN SCHEDULED',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      render: (date: string) => new Date(date).toLocaleTimeString()
    },
    {
      title: 'ERROR DETAILS',
      dataIndex: 'error',
      key: 'error',
      render: (err: any) => <Text type="secondary" style={{ fontSize: '11px' }}>{err?.message || 'None'}</Text>
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (_: any, record: any) => (
        <Button type="link" size="small" onClick={() => setSelectedJobId(record.id)}>
          Inspect
        </Button>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <Title level={4} style={{ margin: 0 }}>
          Job Dispatcher & Explorer
        </Title>
        <Text type="secondary" style={{ fontSize: '12px' }}>
          Dispatch single or batch background jobs and inspect real-time execution streams
        </Text>
      </div>

      {/* Job Dispatcher Engine */}
      <JobDispatcher queues={queues} />

      {/* Execution Stream Logs */}
      <ExecutionStream projectId={selectedProject?.id} />

      {/* Filterable Job Actions Table */}
      <Card
        title={
          <Space>
            <span>Job Actions Log ({meta.total} Total)</span>
          </Space>
        }
        extra={
          <Space>
            <Input
              placeholder="Search job name or ID..."
              prefix={<SearchOutlined />}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{ width: 220 }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} />
          </Space>
        }
      >
        <Space style={{ marginBottom: '16px' }}>
          {filterTabs.map((tab) => (
            <Button
              key={tab.label}
              size="small"
              type={statusFilter === tab.value ? 'primary' : 'default'}
              onClick={() => {
                setStatusFilter(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </Button>
          ))}
        </Space>

        <Table
          columns={columns}
          dataSource={jobs.map((j: any) => ({ ...j, key: j.id }))}
          loading={isLoading}
          pagination={{
            current: meta.page,
            pageSize: 15,
            total: meta.total,
            onChange: (p) => setPage(p)
          }}
          size="middle"
          onRow={(record) => ({
            onClick: () => setSelectedJobId(record.id)
          })}
        />
      </Card>

      {/* Side Drawer for Job Details */}
      {selectedJobId && (
        <JobDetailDrawer
          jobId={selectedJobId}
          onClose={() => setSelectedJobId(null)}
          onAiSummary={() => setAiSummaryJobId(selectedJobId)}
        />
      )}

      <AiSummaryModal jobId={aiSummaryJobId} onClose={() => setAiSummaryJobId(null)} />
    </div>
  );
};

const JobDetailDrawer: React.FC<{
  jobId: string;
  onClose: () => void;
  onAiSummary: () => void;
}> = ({ jobId, onClose, onAiSummary }) => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['job', jobId],
    queryFn: () => apiFetch(`/jobs/${jobId}`)
  });

  const retryMutation = useMutation({
    mutationFn: () => apiFetch(`/jobs/${jobId}/retry`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job', jobId] });
    }
  });

  const job = data?.job;

  return (
    <Drawer
      title={job?.name || 'Job Details'}
      placement="right"
      width={480}
      onClose={onClose}
      open={!!jobId}
    >
      {isLoading ? (
        <Text type="secondary">Loading job details...</Text>
      ) : !job ? (
        <Text type="danger">Job not found.</Text>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <StatusBadge status={job.status} />
            <Space>
              {(job.status === 'FAILED' || job.status === 'DEAD_LETTER') && (
                <>
                  <Button icon={<ExperimentOutlined />} onClick={onAiSummary}>
                    AI Diagnosis
                  </Button>
                  <Button
                    type="primary"
                    icon={<RotateLeftOutlined />}
                    loading={retryMutation.isPending}
                    onClick={() => retryMutation.mutate()}
                  >
                    Manual Retry
                  </Button>
                </>
              )}
            </Space>
          </div>

          <Card size="small" style={{ background: '#f8fafc', borderColor: '#e2e8f0' }}>
            <p><strong>Queue:</strong> {job.queue?.name}</p>
            <p><strong>Attempts:</strong> {job.attemptCount} / {job.maxAttempts}</p>
            <p><strong>Scheduled:</strong> {new Date(job.scheduledAt).toLocaleString()}</p>
            <p><strong>Worker:</strong> {job.worker?.name || 'Unassigned'}</p>
          </Card>

          <JsonViewer title="Job Payload" data={job.payload} />
          {job.result && <JsonViewer title="Execution Result" data={job.result} />}
          {job.error && <JsonViewer title="Exception Details" data={job.error} />}
        </Space>
      )}
    </Drawer>
  );
};
