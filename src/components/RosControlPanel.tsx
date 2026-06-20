import { useEffect, useRef, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import axios from 'axios';
import { Layout, Menu, Empty, Typography } from 'antd';
import {
  MessageOutlined,
  TeamOutlined,
  CustomerServiceOutlined,
} from '@ant-design/icons';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';

const { Sider, Content } = Layout;

type PanelType = 'topic' | 'service';

interface ActivePanel {
  type: PanelType;
  name: string;
  schema: RJSFSchema;
}

interface RosEntry {
  name: string;
  types: string[];
}

interface RosControlPanelProps {
  style?: React.CSSProperties;
  onResponse?: (data: unknown) => void;
  onError?: (error: Error) => void;
}

export function RosControlPanel({ style, onResponse, onError }: RosControlPanelProps) {
  const { serverUrl } = useRos();
  const [nodes, setNodes]       = useState<string[]>([]);
  const [topics, setTopics]     = useState<RosEntry[]>([]);
  const [services, setServices] = useState<RosEntry[]>([]);
  const [active, setActive]     = useState<ActivePanel | null>(null);
  const activeRef               = useRef<ActivePanel | null>(null);

  // Poll ROS graph
  useEffect(() => {
    const fetch = () => {
      axios.get(`${serverUrl}/nodes`).then((r) => setNodes(r.data)).catch(() => {});
      axios.get(`${serverUrl}/topics`).then((r) => setTopics(r.data)).catch(() => {});
      axios.get(`${serverUrl}/services`).then((r) => setServices(r.data)).catch(() => {});
    };
    fetch();
    const id = setInterval(fetch, 2000);
    return () => clearInterval(id);
  }, [serverUrl]);

  // Deregister on unmount
  useEffect(() => {
    return () => {
      if (activeRef.current) {
        axios
          .post(`${serverUrl}/delete/${activeRef.current.type}`, { name: activeRef.current.name })
          .catch(() => {});
      }
    };
  }, [serverUrl]);

  const handleSelect = async (type: PanelType, rawName: string) => {
    const name = rawName.startsWith('/') ? rawName.slice(1) : rawName;

    if (activeRef.current) {
      await axios
        .post(`${serverUrl}/delete/${activeRef.current.type}`, { name: activeRef.current.name })
        .catch(() => {});
    }

    try {
      const res = await axios.post(`${serverUrl}/add/${type}`, { name });
      const panel: ActivePanel = { type, name, schema: res.data };
      activeRef.current = panel;
      setActive(panel);
    } catch (e) {
      console.error(e);
    }
  };

  const menuItems = [
    {
      key: 'nodes',
      icon: <TeamOutlined />,
      label: 'Nodes',
      children: nodes.map((n) => ({ key: n, label: n })),
    },
    {
      key: 'topics',
      icon: <MessageOutlined />,
      label: 'Topics',
      children: topics.map((t) => ({ key: t.name, label: t.name })),
    },
    {
      key: 'services',
      icon: <CustomerServiceOutlined />,
      label: 'Services',
      children: services.map((s) => ({ key: s.name, label: s.name })),
    },
  ];

  return (
    <Layout style={{ height: '100%', ...style }}>
      <Sider theme="light" collapsible>
        <Menu
          mode="inline"
          items={menuItems}
          onClick={({ key, keyPath }) => {
            const section = keyPath[1];
            if (section === 'topics') handleSelect('topic', key);
            else if (section === 'services') handleSelect('service', key);
          }}
        />
      </Sider>
      <Content style={{ padding: 24, overflowY: 'auto' }}>
        {active ? (
          <>
            <Typography.Title level={4}>
              {active.type === 'topic' ? 'Publish' : 'Call'}: {active.name}
            </Typography.Title>
            <RosForm
              schema={active.schema}
              type={active.type}
              name={active.name}
              serverUrl={serverUrl}
              onResponse={onResponse}
              onError={onError}
            />
          </>
        ) : (
          <Empty description="Select a topic or service from the sidebar" />
        )}
      </Content>
    </Layout>
  );
}
