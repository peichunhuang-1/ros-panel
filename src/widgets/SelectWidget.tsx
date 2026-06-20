import type { WidgetProps } from '@rjsf/utils';
import { Select } from 'antd';

// Enum values are stored as "CONSTANT_NAME:numeric_value" strings
export function SelectWidget(props: WidgetProps) {
  const { schema, value, onChange, disabled, readonly } = props;
  const options = (schema.enum ?? []) as string[];

  return (
    <Select
      style={{ width: '100%' }}
      value={value as number | undefined}
      disabled={disabled || readonly}
      onChange={(v) => onChange(v)}
    >
      {options.map((opt) => {
        const [label, numeric] = opt.split(':');
        return (
          <Select.Option key={label} value={Number(numeric)}>
            {label}
          </Select.Option>
        );
      })}
    </Select>
  );
}
