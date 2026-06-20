import type { ArrayFieldTemplateProps } from '@rjsf/utils';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

// In RJSF v6.1.2, items is ReactElement[] — RJSF already called ArrayFieldItemTemplate
// for each item. Just render them; do NOT call ArrayFieldItemTemplate again.
export function ArrayFieldTemplate({ items, canAdd, onAddClick }: ArrayFieldTemplateProps) {
  return (
    <div>
      {items}
      {canAdd && (
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={onAddClick}
          style={{ marginTop: 4 }}
        >
          Add item
        </Button>
      )}
    </div>
  );
}