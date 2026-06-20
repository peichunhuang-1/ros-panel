import { Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';

export function SubmitButton() {
  return (
    <Button type="primary" htmlType="submit" icon={<SendOutlined />} style={{ marginTop: 8 }}>
      Submit
    </Button>
  );
}