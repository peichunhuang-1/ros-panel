import { useEffect, useMemo, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import axios from 'axios';

type EndpointType = 'topic' | 'service';

interface UseRosEndpointResult {
  name: string;
  schema: RJSFSchema | null;
  error: string | null;
}

export function useRosEndpoint(
  type: EndpointType,
  rawName: string,
  serverUrl: string,
): UseRosEndpointResult {
  const name = useMemo(
    () => (rawName.startsWith('/') ? rawName.slice(1) : rawName),
    [rawName],
  );
  const [schema, setSchema] = useState<RJSFSchema | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSchema(null);
    setError(null);
    axios
      .post(`${serverUrl}/add/${type}`, { name })
      .then((res) => setSchema(res.data))
      .catch((err: Error) => setError(err.message));

    return () => {
      axios.post(`${serverUrl}/delete/${type}`, { name }).catch(() => {});
    };
  }, [type, name, serverUrl]);

  return { name, schema, error };
}
