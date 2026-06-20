import type { ArrayFieldItemTemplateProps } from '@rjsf/utils';
import { Button, Space } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, DeleteOutlined } from '@ant-design/icons';

export function ArrayFieldItemTemplate({ children, buttonsProps, hasToolbar }: ArrayFieldItemTemplateProps) {
  // In RJSF v6.1.2, move/remove handlers live in buttonsProps with new names:
  // onMoveUpItem / onMoveDownItem / onRemoveItem (no index currying).
  const {
    hasMoveUp,
    hasMoveDown,
    hasRemove,
    onMoveUpItem,
    onMoveDownItem,
    onRemoveItem,
    disabled,
    readonly,
  } = buttonsProps;

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      marginBottom: 6,
      padding: '12px 14px',
      background: '#fafafa',
      borderRadius: 8,
      border: '1px solid #f0f0f0',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {hasToolbar && (
        <Space size={2} style={{ flexShrink: 0, paddingTop: 2 }}>
          {hasMoveUp && (
            <Button
              type="text"
              size="small"
              icon={<ArrowUpOutlined />}
              onClick={onMoveUpItem}
              disabled={disabled || readonly}
            />
          )}
          {hasMoveDown && (
            <Button
              type="text"
              size="small"
              icon={<ArrowDownOutlined />}
              onClick={onMoveDownItem}
              disabled={disabled || readonly}
            />
          )}
          {hasRemove && (
            <Button
              type="text"
              danger
              size="small"
              icon={<DeleteOutlined />}
              onClick={onRemoveItem}
              disabled={disabled || readonly}
            />
          )}
        </Space>
      )}
    </div>
  );
}