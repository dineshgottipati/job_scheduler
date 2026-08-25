import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../api/client';
import { Card, Form, Select, Input, InputNumber, Button, Alert, Space, Tag } from 'antd';
import { ThunderboltOutlined, RocketOutlined } from '@ant-design/icons';

interface Props {
  queues: any[];
  selectedQueueId?: string;
  onJobDispatched?: () => void;
}

export const JobDispatcher: React.FC<Props> = ({ queues, selectedQueueId, onJobDispatched }) => {
  const queryClient = useQueryClient();

  const [targetQueueId, setTargetQueueId] = useState<string>(selectedQueueId || queues[0]?.id || '');
  const [jobActionName, setJobActionName] = useState<string>('send_email');
  const [executionMode, setExecutionMode] = useState<string>('Standard Success');
  const [payloadRuntime, setPayloadRuntime] = useState<string>('Medium (3 sec)');
  const [batchQuantity, setBatchQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const dispatchMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      setIsSubmitting(true);

      const queueId = targetQueueId || queues[0]?.id;
      if (!queueId) throw new Error('Please select a target queue');
      if (!jobActionName.trim()) throw new Error('Job action name cannot be empty');

      let runtimeMs = 3000;
      if (payloadRuntime.includes('Short')) runtimeMs = 1000;
      if (payloadRuntime.includes('Long')) runtimeMs = 5000;

      const simulateFailure = executionMode === 'Simulate Failure';
      let scheduledAt: string | undefined = undefined;
      if (executionMode === 'Scheduled Delay (10s)') {
        scheduledAt = new Date(Date.now() + 10000).toISOString();
      }

      if (batchQuantity > 1) {
        const batchJobs = Array.from({ length: batchQuantity }).map((_, idx) => ({
          name: `${jobActionName.trim()}-${idx + 1}`,
          payload: {
            jobName: `${jobActionName.trim()}-${idx + 1}`,
            executionMode,
            simulateFailure,
            runtimeMs
          },
          scheduledAt,
          idempotencyKey: `batch-${Date.now()}-${idx}-${Math.random().toString(36).substring(7)}`
        }));

        return apiFetch('/jobs/batch', {
          method: 'POST',
          body: JSON.stringify({
            queueId,
            jobs: batchJobs
          })
        });
      } else {
        return apiFetch('/jobs', {
          method: 'POST',
          body: JSON.stringify({
            queueId,
            name: jobActionName.trim(),
            payload: {
              jobName: jobActionName.trim(),
              executionMode,
              simulateFailure,
              runtimeMs
            },
            scheduledAt
          })
        });
      }
    },
    onSuccess: () => {
      setIsSubmitting(false);
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['queues'] });
      queryClient.invalidateQueries({ queryKey: ['queueStats'] });
      if (onJobDispatched) onJobDispatched();
    },
    onError: (err: any) => {
      setIsSubmitting(false);
      setErrorMsg(err.message || 'Failed to dispatch job batch');
    }
  });

  return (
    <Card
      title={
        <Space>
          <ThunderboltOutlined style={{ color: '#1677ff', fontSize: '18px' }} />
          <span>Job Dispatcher Engine</span>
        </Space>
      }
      extra={<Tag color="blue">Batch Dispatch Active</Tag>}
      style={{ marginBottom: '24px' }}
    >
      {errorMsg && (
        <Alert message={errorMsg} type="error" showIcon style={{ marginBottom: '16px' }} />
      )}

      <Form layout="vertical" onFinish={() => dispatchMutation.mutate()}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <Form.Item label="Target Queue">
            <Select
              value={targetQueueId || queues[0]?.id || ''}
              onChange={(val) => setTargetQueueId(val)}
              options={queues.map((q) => ({ label: `${q.name} (p${q.priority})`, value: q.id }))}
            />
          </Form.Item>

          <Form.Item label="Job Action Name">
            <Input
              placeholder="e.g. send_email, generate_report"
              value={jobActionName}
              onChange={(e) => setJobActionName(e.target.value)}
            />
          </Form.Item>

          <Form.Item label="Execution Mode">
            <Select
              value={executionMode}
              onChange={(val) => setExecutionMode(val)}
              options={[
                { label: 'Standard Success', value: 'Standard Success' },
                { label: 'Simulate Failure', value: 'Simulate Failure' },
                { label: 'Scheduled Delay (10s)', value: 'Scheduled Delay (10s)' }
              ]}
            />
          </Form.Item>

          <Form.Item label="Payload Runtime">
            <Select
              value={payloadRuntime}
              onChange={(val) => setPayloadRuntime(val)}
              options={[
                { label: 'Short (1 sec)', value: 'Short (1 sec)' },
                { label: 'Medium (3 sec)', value: 'Medium (3 sec)' },
                { label: 'Long (5 sec)', value: 'Long (5 sec)' }
              ]}
            />
          </Form.Item>

          <Form.Item label="Batch Quantity">
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              max={50}
              value={batchQuantity}
              onChange={(val) => setBatchQuantity(val || 1)}
            />
          </Form.Item>

          <Form.Item label=" " style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              icon={<RocketOutlined />}
              htmlType="submit"
              loading={isSubmitting}
              block
            >
              Dispatch {batchQuantity > 1 ? `${batchQuantity} Jobs` : 'Job'}
            </Button>
          </Form.Item>
        </div>
      </Form>
    </Card>
  );
};
