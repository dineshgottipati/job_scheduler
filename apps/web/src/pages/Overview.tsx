import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { StatusBadge } from '../components/StatusBadge';
import { CreateJobModal } from '../components/CreateJobModal';
import { useNavigate } from 'react-router-dom';
import { Card, Row, Col, Statistic, Table, Button, Space, Typography, Tag } from 'antd';
import {
  RocketOutlined,
  AppstoreOutlined,
  PlaySquareOutlined,
  ClusterOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  RightOutlined
} from '@ant-design/icons';

const { Title, Paragraph, Text } = Typography;

export const Overview: React.FC = () => {
  const { selectedProject } = useOrg();
  const navigate = useNavigate();
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);

  const { data: queuesData, refetch: refetchQueues } = useQuery({
    queryKey: ['queues', selectedProject?.id],
    queryFn: () => apiFetch(`/queues?projectId=${selectedProject?.id}`),
    enabled: !!selectedProject
  });

  const { data: jobsData, isLoading: jobsLoading, refetch: refetchJobs } = useQuery({
    queryKey: ['jobs', 'recent', selectedProject?.id],
    queryFn: () => apiFetch(`/jobs?projectId=${selectedProject?.id}&pageSize=10`),
    enabled: !!selectedProject
  });

  const { data: workersData } = useQuery({
    queryKey: ['workers'],
    queryFn: () => apiFetch('/workers')
  });

  const queues = queuesData?.queues || [];
  const recentJobs = jobsData?.data || [];
  const workers = workersData?.workers || [];
  const activeWorkers = workers.filter((w: any) => w.status === 'ACTIVE').length;

  const queueColumns = [
    {
      title: 'QUEUE NAME',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text bold style={{ color: '#1677ff' }}>{text}</Text>
    },
    {
      title: 'PRIORITY',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: number) => <Tag color="gold">p{p}</Tag>
    },
    {
      title: 'MAX CONCURRENCY',
      dataIndex: 'maxConcurrency',
      key: 'maxConcurrency',
      render: (c: number) => `${c} max`
    },
    {
      title: 'STATUS',
      dataIndex: 'isPaused',
      key: 'isPaused',
      render: (paused: boolean) => (paused ? <Tag color="warning">PAUSED</Tag> : <Tag color="success">ACTIVE</Tag>)
    },
    {
      title: 'RETRY POLICY',
      dataIndex: 'retryPolicy',
      key: 'retryPolicy',
      render: (policy: any) => policy?.name || 'Exponential'
    }
  ];

  const jobColumns = [
    {
      title: 'JOB ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <Text code style={{ color: '#1677ff' }}>{id.slice(0, 8)}...</Text>
    },
    {
      title: 'HANDLER / NAME',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text bold>{name}</Text>
    },
    {
      title: 'QUEUE',
      dataIndex: 'queueName',
      key: 'queueName',
      render: (q: string) => <Tag color="cyan">{q}</Tag>
    },
    {
      title: 'STATUS',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => <StatusBadge status={status} />
    },
    {
      title: 'CREATED AT',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleTimeString()
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Hero Section */}
      <Card style={{ textAlign: 'center', padding: '16px' }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Tag color="geekblue" style={{ fontSize: '12px', padding: '4px 12px' }}>
            TRANSPARENT HIGH-PERFORMANCE SCHEDULING ENGINE
          </Tag>
          <Title level={2} style={{ margin: 0 }}>
            Schedule & Execute Jobs with <span style={{ color: '#1677ff' }}>Ant Design UI</span>
          </Title>
          <Paragraph type="secondary" style={{ maxWidth: '640px', margin: '0 auto', fontSize: '14px' }}>
            SchedX manages queue concurrency, transactional retry policies, cron scheduling, and worker cluster heartbeats with production reliability.
          </Paragraph>

          <Space size="medium" style={{ justifyContent: 'center', marginTop: '8px' }}>
            <Button
              type="primary"
              size="large"
              icon={<RocketOutlined />}
              onClick={() => setIsSubmitModalOpen(true)}
            >
              Submit Job Now
            </Button>
            <Button
              size="large"
              icon={<AppstoreOutlined />}
              onClick={() => navigate('/queues')}
            >
              Browse Active Queues
            </Button>
          </Space>
        </Space>
      </Card>

      {/* KPI Cards Grid */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="ACTIVE QUEUES"
              value={queues.length}
              prefix={<AppstoreOutlined style={{ color: '#1677ff' }} />}
              suffix={<Text type="secondary" style={{ fontSize: '12px' }}>({queues.filter((q: any) => q.isPaused).length} paused)</Text>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="ACTIVE WORKERS"
              value={activeWorkers}
              prefix={<ClusterOutlined style={{ color: '#722ed1' }} />}
              suffix={<Text type="secondary" style={{ fontSize: '12px' }}>({workers.length} total)</Text>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="RECENT EXECUTIONS"
              value={recentJobs.length}
              prefix={<PlaySquareOutlined style={{ color: '#52c41a' }} />}
              suffix={<Text type="secondary" style={{ fontSize: '12px' }}>(latest 10)</Text>}
            />
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="SYSTEM HEALTH"
              value="Optimal"
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '20px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Active Queues Summary */}
      <Card
        title={
          <Space>
            <AppstoreOutlined style={{ color: '#1677ff' }} />
            <span>Active Queues Breakdown</span>
          </Space>
        }
        extra={
          <Button type="link" onClick={() => navigate('/queues')} icon={<RightOutlined />}>
            View All
          </Button>
        }
      >
        <Table
          columns={queueColumns}
          dataSource={queues.map((q: any) => ({ ...q, key: q.id }))}
          pagination={false}
          size="small"
        />
      </Card>

      {/* Recent Executions */}
      <Card
        title={
          <Space>
            <PlaySquareOutlined style={{ color: '#722ed1' }} />
            <span>Recent Job Executions</span>
          </Space>
        }
        extra={
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              refetchQueues();
              refetchJobs();
            }}
          />
        }
      >
        <Table
          columns={jobColumns}
          dataSource={recentJobs.map((j: any) => ({ ...j, key: j.id }))}
          loading={jobsLoading}
          pagination={false}
          size="small"
        />
      </Card>

      <CreateJobModal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        queues={queues}
      />
    </div>
  );
};
