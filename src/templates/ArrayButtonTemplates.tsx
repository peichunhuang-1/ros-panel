import type { IconButtonProps } from '@rjsf/utils';
import { Button } from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';

export function AddButton({ onClick, disabled }: IconButtonProps) {
  return (
    <Button
      type="dashed"
      size="small"
      icon={<PlusOutlined />}
      onClick={onClick}
      disabled={disabled}
      style={{ marginTop: 4 }}
    />
  );
}

export function RemoveButton({ onClick, disabled }: IconButtonProps) {
  return (
    <Button
      type="text"
      danger
      size="small"
      icon={<DeleteOutlined />}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

export function MoveUpButton({ onClick, disabled }: IconButtonProps) {
  return (
    <Button
      type="text"
      size="small"
      icon={<ArrowUpOutlined />}
      onClick={onClick}
      disabled={disabled}
    />
  );
}

export function MoveDownButton({ onClick, disabled }: IconButtonProps) {
  return (
    <Button
      type="text"
      size="small"
      icon={<ArrowDownOutlined />}
      onClick={onClick}
      disabled={disabled}
    />
  );
}