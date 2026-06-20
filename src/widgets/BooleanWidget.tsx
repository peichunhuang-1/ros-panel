import type { WidgetProps } from '@rjsf/utils';
import { Switch } from 'antd';

export function BooleanWidget(props: WidgetProps) {
  return (
    <Switch
      checked={!!props.value}
      disabled={props.disabled || props.readonly}
      onChange={(checked) => props.onChange(checked)}
    />
  );
}
