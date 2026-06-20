import { Spin, Alert, Typography } from 'antd';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';
import { useRosEndpoint } from '../hooks/useRosEndpoint';

interface ServiceCallerProps {
  service: string;
  title?: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function ServiceCaller({ service, title, onResponse, onError }: ServiceCallerProps) {
  const { serverUrl } = useRos();
  const { name, schema, error } = useRosEndpoint('service', service, serverUrl);

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
