import { useEffect, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import axios from 'axios';
import { Spin, Alert, Typography } from 'antd';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';

interface ServiceCallerProps {
  service: string;
  title?: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function ServiceCaller({ service, title, onResponse, onError }: ServiceCallerProps) {
  const { serverUrl } = useRos();
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = service.startsWith('/') ? service.slice(1) : service;

  useEffect(() => {
    setSchema(null);
    setError(null);
    axios
      .post(`${serverUrl}/add/service`, { name })
      .then((res) => setSchema(res.data))
      .catch((err: Error) => setError(err.message));

    return () => {
      axios.post(`${serverUrl}/delete/service`, { name }).catch(() => {});
    };
  }, [service, serverUrl, name]);

  if (error) return <Alert type="error" message={error} />;
  if (!schema) return <Spin tip="Connecting to service..." />;

  return (
    <div>
      <Typography.Title level={5}>{title ?? service}</Typography.Title>
      <RosForm
        schema={schema}
        type="service"
        name={name}
        serverUrl={serverUrl}
        onResponse={onResponse}
        onError={onError}
      />
    </div>
  );
}
