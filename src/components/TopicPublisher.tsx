import { Spin, Alert, Typography } from 'antd';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';
import { useRosEndpoint } from '../hooks/useRosEndpoint';

interface TopicPublisherProps {
  topic: string;
  title?: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function TopicPublisher({ topic, title, onResponse, onError }: TopicPublisherProps) {
  const { serverUrl } = useRos();
  const { name, schema, error } = useRosEndpoint('topic', topic, serverUrl);

  if (error) return <Alert type="error" message={error} />;
  if (!schema) return <Spin tip="Connecting to topic..." />;

  return (
    <div>
      <Typography.Title level={5}>{title ?? topic}</Typography.Title>
      <RosForm
        schema={schema}
        type="topic"
        name={name}
        serverUrl={serverUrl}
        onResponse={onResponse}
        onError={onError}
      />
    </div>
  );
}
