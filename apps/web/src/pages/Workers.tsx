import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { Card, Form, Input, InputNumber, Button, Row, Col, Tag, Alert, Popconfirm, Space, Typography } from 'antd';
import { ClusterOutlined, PlusOutlined, ReloadOutlined, PauseCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export const Workers: React.FC = () => {
  const queryClient = useQueryClient();

  const [workerName, setWorkerName] = useState('');
  const [hostname, setHostname] = useState('local');
  const [concurrency, setConcurrency] = useState(5);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['workers'],
    queryFn: () => apiFetch('/workers'),
    refetchInterval: 3000
  });

  const workers = data?.workers || [];

  const addWorkerMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setIsAdding(true);

      const name = workerName.trim() || `worker-${Math.floor(Math.random() * 10000)}-${workers.length + 1}`;

      return apiFetch('/workers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          hostname: hostname.trim() || 'local',
          concurrency
        })
      });
    },
    onSuccess: () => {
      setIsAdding(false);
      setWorkerName('');
      queryClient.invalidateQueries({ queryKey: ['workers'] });
    },
    onError: (err: any) => {
      setIsAdding(false);
      setErrorMsg(err.message || 'Failed to add worker node');
    }
  });

  const stopWorkerMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/workers/${id}/stop`, { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workers'] })
  });

  const removeWorkerMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/workers/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workers'] })
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header Actions */}
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Worker Nodes Cluster
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Add, monitor, and remove active polling worker nodes in the cluster
            </Text>
          </div>
          <Space>
            <Tag color="cyan">{workers.filter((w: any) => w.status === 'ACTIVE').length} Active Nodes</Tag>
            <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
              Refresh
            </Button>
          </Space>
        </div>
      </Card>

      {/* Add Worker Node Form */}
      <Card
        title={
          <Space>
            <ClusterOutlined style={{ color: '#1677ff', fontSize: '18px' }} />
            <span>Add New Worker Node</span>
          </Space>
        }
      >
        {errorMsg && (
          <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: '16px' }} />
        )}

        <Form layout="vertical" onFinish={() => addWorkerMutation.mutate()}>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="WORKER NAME / IDENTIFIER">
                <Input
                  placeholder="e.g. worker-19880-6 (Auto-generated if empty)"
                  value={workerName}
                  onChange={(e) => setWorkerName(e.target.value)}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="HOST / INSTANCE">
                <Input
                  value={hostname}
                  onChange={(e) => setHostname(e.target.value)}
                />
              </Form.Item>
            </Col>

            <Col xs={24} md={8}>
              <Form.Item label="CONCURRENCY SLOTS">
                <InputNumber
                  style={{ width: '100%' }}
                  min={1}
                  max={50}
                  value={concurrency}
                  onChange={(val) => setConcurrency(val || 5)}
                />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              htmlType="submit"
              loading={isAdding}
            >
              Add Worker Node
            </Button>
          </div>
        </Form>
      </Card>

      {/* Worker Cards Grid */}
      <Row gutter={[16, 16]}>
        {workers.map((w: any) => (
          <Col xs={24} sm={12} lg={8} key={w.id}>
            <Card
              title={
                <Text bold style={{ color: '#1677ff', fontFamily: 'monospace' }}>
                  {w.name}
                </Text>
              }
              extra={
                w.status === 'ACTIVE' ? (
                  <Tag color="cyan">Online</Tag>
                ) : (
                  <Tag color="error">{w.status}</Tag>
                )
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="small">
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Host: <Text style={{ fontWeight: 600 }}>{w.hostname}</Text> | Concurrency: <Text style={{ fontWeight: 600 }}>{w.concurrency} slots</Text>
                </Text>

                <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                  <Text type="secondary" style={{ fontSize: '10px', display: 'block' }}>
                    Last Executed:
                  </Text>
                  <Text bold style={{ color: '#0f172a', fontSize: '12px', fontFamily: 'monospace' }}>
                    {w.lastExecutedJob || 'Idle (-)'}
                  </Text>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '8px' }}>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    Heartbeat: {new Date(w.lastHeartbeatAt).toLocaleTimeString()}
                  </Text>

                  <Space size="small">
                    {w.status === 'ACTIVE' && (
                      <Button
                        size="small"
                        icon={<PauseCircleOutlined />}
                        onClick={() => stopWorkerMutation.mutate(w.id)}
                      >
                        Stop
                      </Button>
                    )}
                    <Popconfirm
                      title="Remove worker"
                      description={`Remove worker node "${w.name}"?`}
                      onConfirm={() => removeWorkerMutation.mutate(w.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
};
