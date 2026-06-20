import type { WidgetProps } from '@rjsf/utils';
import { Input, InputNumber } from 'antd';

export function TextWidget(props: WidgetProps) {
  const { schema, value, onChange, disabled, readonly, required } = props;

  if (schema.type === 'integer' || schema.type === 'number') {
    return (
      <InputNumber
        style={{ width: '100%' }}
        value={value as number}
        min={schema.minimum as number | undefined}
        max={schema.maximum as number | undefined}
        disabled={disabled || readonly}
        required={required}
        onChange={(v) => onChange(v ?? undefined)}
      />
    );
  }

  return (
    <Input
      style={{ width: '100%' }}
      value={(value as string) ?? ''}
      disabled={disabled || readonly}
      required={required}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
