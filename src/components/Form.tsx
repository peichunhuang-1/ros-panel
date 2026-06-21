import { useState } from 'react';
import RjsfForm from '@rjsf/core';
import type { RJSFSchema, RegistryWidgetsType, TemplatesType } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import axios from 'axios';
import { Alert, Typography } from 'antd';
import { BooleanWidget } from '../widgets/BooleanWidget';
import { TextWidget } from '../widgets/TextWidget';
import { SelectWidget } from '../widgets/SelectWidget';
import { AddButton, RemoveButton, MoveUpButton, MoveDownButton } from '../templates/ArrayButtonTemplates';
import { FieldTemplate } from '../templates/FieldTemplate';
import { ObjectFieldTemplate } from '../templates/ObjectFieldTemplate';
import { ArrayFieldTemplate } from '../templates/ArrayFieldTemplate';
import { ArrayFieldItemTemplate } from '../templates/ArrayFieldItemTemplate';
import { SubmitButton } from '../templates/SubmitButton';

const widgets: RegistryWidgetsType = {
  CheckboxWidget: BooleanWidget,
  TextWidget,
  SelectWidget,
};

const templates: Partial<TemplatesType> = {
  FieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  ArrayFieldItemTemplate,
  // Suppress the default ArrayFieldItemButtonsTemplate — our ArrayFieldItemTemplate
  // already renders Up/Down/Remove directly from buttonsProps, so the default
  // buttons template (which adds a second Add button) must be a no-op.
  ArrayFieldItemButtonsTemplate: () => null,
  ButtonTemplates: {
    AddButton,
    RemoveButton,
    MoveUpButton,
    MoveDownButton,
    SubmitButton,
  } as unknown as TemplatesType['ButtonTemplates'],
};

export interface RosFormProps {
  schema: RJSFSchema;
  type: 'topic' | 'service';
  name: string;
  serverUrl: string;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function RosForm({ schema, type, name, serverUrl, onResponse, onError }: RosFormProps) {
  const [formData, setFormData] = useState<unknown>({});
  const [response, setResponse] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const normalizedSchema: RJSFSchema = schema.type ? schema : { type: 'object', ...schema };

  const handleSubmit = () => {
    setErrorMsg(null);
    axios
      .post(`${serverUrl}/call/service`, { type, name, form: formData })
      .then((res) => {
        setResponse(res.data);
        onResponse?.(res.data);
      })
      .catch((err: Error) => {
        setErrorMsg(err.message);
        onError?.(err);
      });
  };

  return (
    <div>
      <RjsfForm
        schema={normalizedSchema}
        formData={formData}
        onChange={(e) => setFormData(e.formData)}
        validator={validator}
        widgets={widgets}
        templates={templates}
        onSubmit={handleSubmit}
      />
      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          closable
          onClose={() => setErrorMsg(null)}
          style={{ marginTop: 12 }}
        />
      )}
      {response !== null && (
        <Alert
          type="success"
          message="Response"
          description={
            <Typography.Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {JSON.stringify(response, null, 2)}
            </Typography.Text>
          }
          closable
          onClose={() => setResponse(null)}
          style={{ marginTop: 12 }}
        />
      )}
    </div>
  );
}