import { useEffect, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import axios from 'axios';
import { Spin, Alert, Typography } from 'antd';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';

interface TopicPublisherProps {
  topic: string;
  title?: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function TopicPublisher({ topic, title, onResponse, onError }: TopicPublisherProps) {
  const { serverUrl } = useRos();
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = topic.startsWith('/') ? topic.slice(1) : topic;

  useEffect(() => {
    setSchema(null);
    setError(null);
    axios
      .post(`${serverUrl}/add/topic`, { name })
      .then((res) => setSchema(res.data))
      .catch((err: Error) => setError(err.message));

    return () => {
      axios.post(`${serverUrl}/delete/topic`, { name }).catch(() => {});
    };
  }, [topic, serverUrl, name]);

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
