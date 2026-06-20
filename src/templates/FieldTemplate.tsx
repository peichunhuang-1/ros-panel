import type { FieldTemplateProps } from '@rjsf/utils';
import { Form } from 'antd';

export function FieldTemplate({ id, label, children, required, rawErrors, hidden }: FieldTemplateProps) {
  if (hidden) return <>{children}</>;

  // Root object wrapper has id='root' — no label needed, just render children
  if (id === 'root' || !label) return <>{children}</>;

  return (
    <Form.Item
      htmlFor={id}
      label={label}
      required={required}
      colon={false}
      validateStatus={rawErrors?.length ? 'error' : undefined}
      help={rawErrors?.[0]}
      layout="vertical"
      style={{ marginBottom: 12 }}
    >
      {children}
    </Form.Item>
  );
}