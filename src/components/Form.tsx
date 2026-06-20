import { useState } from 'react';
import RjsfForm from '@rjsf/core';
import type { RJSFSchema, RegistryWidgetsType } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import axios from 'axios';
import { BooleanWidget } from '../widgets/BooleanWidget';
import { TextWidget } from '../widgets/TextWidget';
import { SelectWidget } from '../widgets/SelectWidget';

const widgets: RegistryWidgetsType = {
  CheckboxWidget: BooleanWidget,
  TextWidget,
  SelectWidget,
};

interface RosFormProps {
  schema: RJSFSchema;
  type: 'topic' | 'service';
  name: string;
  serverUrl: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function RosForm({ schema, type, name, serverUrl, onResponse, onError }: RosFormProps) {
  const [formData, setFormData] = useState<unknown>({});

  // Ensure root has type: object so RJSF renders correctly
  const normalizedSchema: RJSFSchema = schema.type ? schema : { type: 'object', ...schema };

  const handleSubmit = () => {
    axios
      .post(`${serverUrl}/call_api`, { type, name, form: formData })
      .then((res) => onResponse?.(res.data))
      .catch((err: Error) => onError?.(err));
  };

  return (
    <RjsfForm
      schema={normalizedSchema}
      formData={formData}
      onChange={(e) => setFormData(e.formData)}
      validator={validator}
      widgets={widgets}
      onSubmit={handleSubmit}
    />
  );
}
