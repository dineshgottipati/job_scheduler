import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { useOrg } from '../context/OrgContext';
import { Card, Table, Button, Modal, Form, Input, Select, Space, Tag, Popconfirm, Typography } from 'antd';
import { ScheduleOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

export const ScheduledJobs: React.FC = () => {
  const { selectedProject } = useOrg();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: queuesData } = useQuery({
    queryKey: ['queues', selectedProject?.id],
    queryFn: () => apiFetch(`/queues?projectId=${selectedProject?.id}`),
    enabled: !!selectedProject
  });

  const queues = queuesData?.queues || [];

  const { data, isLoading } = useQuery({
    queryKey: ['scheduledJobs', selectedProject?.id],
    queryFn: () => apiFetch('/scheduled-jobs')
  });

  const scheduledJobs = data?.scheduledJobs || [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/scheduled-jobs/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['scheduledJobs'] })
  });

  const columns = [
    {
      title: 'JOB NAME',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <Text bold>{name}</Text>
    },
    {
      title: 'CRON EXPRESSION',
      dataIndex: 'cronExpression',
      key: 'cronExpression',
      render: (expr: string) => <Tag color="blue">{expr}</Tag>
    },
    {
      title: 'TARGET QUEUE',
      dataIndex: 'queue',
      key: 'queue',
      render: (q: any) => <Tag color="cyan">{q?.name || 'Default'}</Tag>
    },
    {
      title: 'TIMEZONE',
      dataIndex: 'timezone',
      key: 'timezone'
    },
    {
      title: 'NEXT RUN AT',
      dataIndex: 'nextRunAt',
      key: 'nextRunAt',
      render: (date: string) => (date ? <Text style={{ color: '#52c41a', fontWeight: 600 }}>{new Date(date).toLocaleString()}</Text> : 'N/A')
    },
    {
      title: 'ACTION',
      key: 'action',
      render: (_: any, record: any) => (
        <Popconfirm
          title="Delete cron schedule"
          description={`Delete schedule "${record.name}"?`}
          onConfirm={() => deleteMutation.mutate(record.id)}
          okText="Yes"
          cancelText="No"
        >
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      )
    }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              Scheduled Cron Jobs
            </Title>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Recurring cron schedules with timezone support
            </Text>
          </div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            Create Cron Schedule
          </Button>
        </div>
      </Card>

      <Card title="Active Cron Schedules">
        <Table
          columns={columns}
          dataSource={scheduledJobs.map((item: any) => ({ ...item, key: item.id }))}
          loading={isLoading}
          pagination={false}
          size="middle"
        />
      </Card>

      <CreateCronModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} queues={queues} />
    </div>
  );
};

const CreateCronModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  queues: any[];
}> = ({ isOpen, onClose, queues }) => {
  const queryClient = useQueryClient();
  const [queueId, setQueueId] = useState(queues[0]?.id || '');
  const [name, setName] = useState('generate_report');
  const [cronExpression, setCronExpression] = useState('0 0 * * *');
  const [timezone, setTimezone] = useState('UTC');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch('/scheduled-jobs', {
        method: 'POST',
        body: JSON.stringify({
          queueId: queueId || queues[0]?.id,
          name,
          cronExpression,
          timezone
        })
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scheduledJobs'] });
      onClose();
    },
    onError: (err: any) => setErrorMsg(err.message)
  });

  return (
    <Modal
      title="Create Cron Schedule"
      open={isOpen}
      onCancel={onClose}
      onOk={() => createMutation.mutate()}
      confirmLoading={createMutation.isPending}
    >
      <Form layout="vertical">
        <Form.Item label="Target Queue">
          <Select
            value={queueId || queues[0]?.id || ''}
            onChange={(val) => setQueueId(val)}
            options={queues.map((q) => ({ label: q.name, value: q.id }))}
          />
        </Form.Item>

        <Form.Item label="Job Handler Name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Form.Item>

        <Form.Item label="Cron Expression" help='Example: "*/15 * * * *" (Every 15 minutes)'>
          <Input value={cronExpression} onChange={(e) => setCronExpression(e.target.value)} />
        </Form.Item>

        <Form.Item label="Timezone">
          <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
