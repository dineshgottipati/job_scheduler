import React from 'react';
import { Tag } from 'antd';
import { SyncOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

interface Props {
  status: string;
}

export const StatusBadge: React.FC<Props> = ({ status }) => {
  switch (status) {
    case 'QUEUED':
      return <Tag color="blue" icon={<ClockCircleOutlined />}>QUEUED</Tag>;
    case 'SCHEDULED':
      return <Tag color="warning" icon={<ClockCircleOutlined />}>SCHEDULED</Tag>;
    case 'CLAIMED':
    case 'RUNNING':
      return <Tag color="processing" icon={<SyncOutlined spin />}>RUNNING</Tag>;
    case 'COMPLETED':
      return <Tag color="success" icon={<CheckCircleOutlined />}>COMPLETED</Tag>;
    case 'FAILED':
      return <Tag color="error" icon={<CloseCircleOutlined />}>FAILED</Tag>;
    case 'DEAD_LETTER':
      return <Tag color="magenta" icon={<ExclamationCircleOutlined />}>DEAD LETTER</Tag>;
    case 'ACTIVE':
      return <Tag color="green">ACTIVE</Tag>;
    case 'STOPPED':
    case 'PAUSED':
      return <Tag color="orange">PAUSED</Tag>;
    default:
      return <Tag>{status}</Tag>;
  }
};
