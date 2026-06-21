import { useRef, useState } from 'react';
import RjsfForm from '@rjsf/core';
import type { RJSFSchema, RegistryWidgetsType, TemplatesType, UiSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Alert, Badge, Button, Space, Spin, Typography } from 'antd';
import { SendOutlined, StopOutlined } from '@ant-design/icons';
import { BooleanWidget } from '../widgets/BooleanWidget';
import { TextWidget } from '../widgets/TextWidget';
import { SelectWidget } from '../widgets/SelectWidget';
import { AddButton, RemoveButton, MoveUpButton, MoveDownButton } from '../templates/ArrayButtonTemplates';
import { FieldTemplate } from '../templates/FieldTemplate';
import { ObjectFieldTemplate } from '../templates/ObjectFieldTemplate';
import { ArrayFieldTemplate } from '../templates/ArrayFieldTemplate';
import { ArrayFieldItemTemplate } from '../templates/ArrayFieldItemTemplate';
import { SubmitButton } from '../templates/SubmitButton';

const widgets: RegistryWidgetsType = { CheckboxWidget: BooleanWidget, TextWidget, SelectWidget };

const templates: Partial<TemplatesType> = {
  FieldTemplate,
  ObjectFieldTemplate,
  ArrayFieldTemplate,
  ArrayFieldItemTemplate,
  ArrayFieldItemButtonsTemplate: () => null,
  ButtonTemplates: {
    AddButton, RemoveButton, MoveUpButton, MoveDownButton, SubmitButton,
  } as unknown as TemplatesType['ButtonTemplates'],
};

export interface ActionSchema {
  goal: Record<string, RJSFSchema>;
  result: Record<string, RJSFSchema>;
  feedback: Record<string, RJSFSchema>;
}

export interface ActionCallerProps {
  schema: ActionSchema;
  name: string;
  serverUrl: string;
  uiSchema?: UiSchema;
  defaultFormData?: unknown;
}

type Status = 'idle' | 'running' | 'done' | 'error';

export function ActionCaller({ schema, name, serverUrl, uiSchema, defaultFormData }: ActionCallerProps) {
  const [formData, setFormData] = useState<unknown>(defaultFormData ?? {});
  const [status, setStatus] = useState<Status>('idle');
  const [feedbackLog, setFeedbackLog] = useState<unknown[]>([]);
  const [result, setResult] = useState<unknown>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const goalSchema: RJSFSchema = { type: 'object', properties: schema.goal ?? {} };

  const handleSubmit = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setStatus('running');
    setFeedbackLog([]);
    setResult(null);
    setErrorMsg(null);

    try {
      const response = await fetch(`${serverUrl}/call/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, form: formData }),
        signal: ctrl.signal,
      });

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        const chunks = buf.split('\n\n');
        buf = chunks.pop() ?? '';

        for (const chunk of chunks) {
          let eventType = '';
          let data = '';
          for (const line of chunk.split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: '))  data      = line.slice(6).trim();
          }
          if (!eventType || !data) continue;
          try {
            const parsed = JSON.parse(data);
            if (eventType === 'feedback') setFeedbackLog((prev) => [...prev, parsed]);
            if (eventType === 'result')   { setResult(parsed); setStatus('done'); }
            if (eventType === 'error')    { setErrorMsg(parsed.message ?? JSON.stringify(parsed)); setStatus('error'); }
          } catch { /* malformed SSE chunk */ }
        }
      }

      if (status === 'running') setStatus('done');
    } catch (e: unknown) {
      if ((e as { name?: string }).name !== 'AbortError') {
        setErrorMsg((e as Error).message);
        setStatus('error');
      }
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setStatus('idle');
  };

  return (
    <div>
      <RjsfForm
        schema={goalSchema}
        uiSchema={uiSchema}
        formData={formData}
        onChange={(e) => setFormData(e.formData)}
        validator={validator}
        widgets={widgets}
        templates={templates}
        onSubmit={handleSubmit}
      >
        <Space style={{ marginTop: 8 }}>
          <Button
            type="primary"
            htmlType="submit"
            icon={<SendOutlined />}
            loading={status === 'running'}
          >
            Send Goal
          </Button>
          {status === 'running' && (
            <Button icon={<StopOutlined />} onClick={handleCancel}>
              Cancel
            </Button>
          )}
        </Space>
      </RjsfForm>

      {status === 'running' && feedbackLog.length === 0 && (
        <Spin style={{ marginTop: 12 }} />
      )}

      {feedbackLog.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Space align="center" style={{ marginBottom: 6 }}>
            <Badge status="processing" />
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              Feedback
            </Typography.Text>
          </Space>
          <div style={{
            maxHeight: 180,
            overflowY: 'auto',
            background: '#1a1a2e',
            borderRadius: 6,
            padding: '8px 12px',
          }}>
            {feedbackLog.map((f, i) => (
              <Typography.Text
                key={i}
                code
                style={{ display: 'block', fontSize: 11, color: '#a0e9a0', whiteSpace: 'pre-wrap' }}
              >
                {JSON.stringify(f, null, 2)}
              </Typography.Text>
            ))}
          </div>
        </div>
      )}

      {result !== null && (
        <Alert
          type="success"
          message="Result"
          description={
            <Typography.Text code style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
              {JSON.stringify(result, null, 2)}
            </Typography.Text>
          }
          closable
          onClose={() => { setResult(null); setStatus('idle'); }}
          style={{ marginTop: 12 }}
        />
      )}

      {errorMsg && (
        <Alert
          type="error"
          message={errorMsg}
          closable
          onClose={() => { setErrorMsg(null); setStatus('idle'); }}
          style={{ marginTop: 12 }}
        />
      )}
    </div>
  );
}