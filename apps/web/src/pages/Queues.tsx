import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { Card, Form, Input, InputNumber, Select, Button, Table, Tag, Space, Alert, Popconfirm } from 'antd';
import { AppstoreOutlined, PlusOutlined, PauseOutlined, CaretRightOutlined, DeleteOutlined } from '@ant-design/icons';

export const Queues: React.FC = () => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();

  const [queueIdentifier, setQueueIdentifier] = useState('');
  const [priority, setPriority] = useState(5);
  const [concurrencyLimit, setConcurrencyLimit] = useState(3);
  const [retryPolicy, setRetryPolicy] = useState('Exponential Backoff (1s base)');
  const [isCreating, setIsCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data: queuesData, isLoading } = useQuery({
    queryKey: ['queues', selectedProject?.id],
    queryFn: () => apiFetch(`/queues?projectId=${selectedProject?.id}`),
    enabled: !!selectedProject
  });

  const queues = queuesData?.queues || [];

  const createMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setIsCreating(true);
      if (!selectedProject) throw new Error('Please select a project');
      if (!queueIdentifier.trim()) throw new Error('Queue identifier cannot be empty');

      return apiFetch('/queues', {
        method: 'POST',
        body: JSON.stringify({
          projectId: selectedProject.id,
          name: queueIdentifier.trim(),
          priority,
          maxConcurrency: concurrencyLimit
        })
      });
    },
    onSuccess: () => {
      setIsCreating(false);
      setQueueIdentifier('');
      queryClient.invalidateQueries({ queryKey: ['queues'] });
    },
    onError: (err: any) => {
      setIsCreating(false);
      setErrorMsg(err.message || 'Failed to create queue');
    }
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/queues/${id}/pause`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queues'] })
  });

  const resumeMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/queues/${id}/resume`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queues'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/queues/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['queues'] })
  });

  const columns = [
    {
      title: 'QUEUE NAME',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <strong style={{ color: '#1677ff' }}>{text}</strong>
    },
    {
      title: 'DISPATCH PRIORITY',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: number) => <Tag color="gold">p{p}</Tag>
    },
    {
      title: 'CONCURRENCY LIMIT',
      dataIndex: 'maxConcurrency',
      key: 'maxConcurrency',
      render: (c: number) => `${c} max`
    },
    {
      title: 'RETRY POLICY',
      dataIndex: 'retryPolicy',
      key: 'retryPolicy',
      render: (policy: any) => <Tag color="orange">{policy?.name || 'Exponential'}</Tag>
    },
    {
      title: 'ENGINE STATUS',
      dataIndex: 'isPaused',
      key: 'isPaused',
      render: (paused: boolean) => (paused ? <Tag color="warning">Paused</Tag> : <Tag color="success">Active</Tag>)
    },
    {
      title: 'MANAGEMENT',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          {record.isPaused ? (
            <Button
              size="small"
              icon={<CaretRightOutlined />}
              onClick={() => resumeMutation.mutate(record.id)}
            >
              Resume
            </Button>
          ) : (
            <Button
              size="small"
              icon={<PauseOutlined />}
              onClick={() => pauseMutation.mutate(record.id)}
            >
              Pause
            </Button>
          )}

          <Popconfirm
            title="Delete queue"
            description={`Are you sure you want to delete queue "${record.name}"?`}
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Inline Queue Manager Creation Form */}
      <Card
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1677ff', fontSize: '18px' }} />
            <span>Queue Manager ({queues.length} Configured)</span>
          </Space>
        }
      >
        {errorMsg && (
          <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: '16px' }} />
        )}

        <Form layout="vertical" onFinish={() => createMutation.mutate()}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <Form.Item label="QUEUE IDENTIFIER" required>
              <Input
                placeholder="Enter queue identifier (e.g. emails-high-priority)"
                value={queueIdentifier}
                onChange={(e) => setQueueIdentifier(e.target.value)}
              />
            </Form.Item>

            <Form.Item label="PRIORITY (0-10)">
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                max={10}
                value={priority}
                onChange={(val) => setPriority(val || 5)}
              />
            </Form.Item>

            <Form.Item label="CONCURRENCY LIMIT">
              <InputNumber
                style={{ width: '100%' }}
                min={1}
                max={50}
                value={concurrencyLimit}
                onChange={(val) => setConcurrencyLimit(val || 3)}
              />
            </Form.Item>

            <Form.Item label="RETRY POLICY">
              <Select
                value={retryPolicy}
                onChange={(val) => setRetryPolicy(val)}
                options={[
                  { label: 'Exponential Backoff (1s base)', value: 'Exponential Backoff (1s base)' },
                  { label: 'Linear Backoff (2s base)', value: 'Linear Backoff (2s base)' },
                  { label: 'Fixed Delay (3s base)', value: 'Fixed Delay (3s base)' }
                ]}
              />
            </Form.Item>

            <Form.Item label=" " style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                htmlType="submit"
                loading={isCreating}
                block
              >
                Create Queue
              </Button>
            </Form.Item>
          </div>
        </Form>
      </Card>

      {/* Queue Manager Table */}
      <Card title="Configured Queues">
        <Table
          columns={columns}
          dataSource={queues.map((q: any) => ({ ...q, key: q.id }))}
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};
