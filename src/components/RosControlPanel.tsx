import { useEffect, useRef, useState } from 'react';
import type { RJSFSchema } from '@rjsf/utils';
import axios from 'axios';
import { Badge, Layout, Menu, Space, Tag, Tooltip, Typography } from 'antd';
import {
  ApartmentOutlined,
  MessageOutlined,
  CustomerServiceOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useRos } from '../context/RosContext';
import { RosForm } from './Form';
import { ActionCaller } from './ActionCaller';

const { Sider, Content } = Layout;

type PanelType = 'topic' | 'service' | 'action';

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
  const [actions, setActions]   = useState<RosEntry[]>([]);
  const [active, setActive]     = useState<ActivePanel | null>(null);
  const [connected, setConnected] = useState(false);
  const activeRef               = useRef<ActivePanel | null>(null);

  useEffect(() => {
    const poll = () => {
      Promise.all([
        axios.get(`${serverUrl}/nodes`),
        axios.get(`${serverUrl}/topics`),
        axios.get(`${serverUrl}/services`),
        axios.get(`${serverUrl}/actions`),
      ])
        .then(([n, t, s, a]) => {
          setNodes(n.data as string[]);
          setTopics(t.data as RosEntry[]);
          setServices(s.data as RosEntry[]);
          setActions(a.data as RosEntry[]);
          setConnected(true);
        })
        .catch(() => setConnected(false));
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [serverUrl]);

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
      const panel: ActivePanel = { type, name, schema: res.data as RJSFSchema };
      activeRef.current = panel;
      setActive(panel);
    } catch (e) {
      console.error(e);
    }
  };

  const sectionLabel = (icon: React.ReactNode, text: string, count: number) => (
    <Space size={6}>
      {icon}
      <span>{text}</span>
      <Badge
        count={count}
        size="small"
        style={{ backgroundColor: '#ffffff22', color: '#ffffffcc', boxShadow: 'none', fontSize: 10 }}
      />
    </Space>
  );

  const menuItems = [
    {
      key: 'nodes',
      label: sectionLabel(<ApartmentOutlined />, 'Nodes', nodes.length),
      children: nodes.map((n) => ({
        key: n,
        label: <Tooltip title={n} placement="right"><span className="rp-menu-item">{n}</span></Tooltip>,
      })),
    },
    {
      key: 'topics',
      label: sectionLabel(<MessageOutlined />, 'Topics', topics.length),
      children: topics.map((t) => ({
        key: t.name,
        label: <Tooltip title={t.name} placement="right"><span className="rp-menu-item">{t.name}</span></Tooltip>,
      })),
    },
    {
      key: 'services',
      label: sectionLabel(<CustomerServiceOutlined />, 'Services', services.length),
      children: services.map((s) => ({
        key: s.name,
        label: <Tooltip title={s.name} placement="right"><span className="rp-menu-item">{s.name}</span></Tooltip>,
      })),
    },
    {
      key: 'actions',
      label: sectionLabel(<ThunderboltOutlined />, 'Actions', actions.length),
      children: actions.map((a) => ({
        key: a.name,
        label: <Tooltip title={a.name} placement="right"><span className="rp-menu-item">{a.name}</span></Tooltip>,
      })),
    },
  ];

  const typeTag = active?.type === 'topic'
    ? <Tag color="green">publish</Tag>
    : active?.type === 'action'
    ? <Tag color="purple">action</Tag>
    : <Tag color="blue">call</Tag>;

  return (
    <Layout style={{ height: '100%', ...style }}>
      <Sider theme="dark" collapsible width={240} style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}>
          <Typography.Text style={{ color: '#fff', fontWeight: 700, fontSize: 13, letterSpacing: '0.05em' }}>
            ROS PANEL
          </Typography.Text>
          <Badge
            status={connected ? 'success' : 'error'}
            text={
              <Typography.Text style={{ color: connected ? '#52c41a' : '#ff4d4f', fontSize: 11 }}>
                {connected ? 'live' : 'offline'}
              </Typography.Text>
            }
          />
        </div>

        <Menu
          mode="inline"
          theme="dark"
          items={menuItems}
          style={{ flex: 1, borderRight: 0, overflow: 'auto' }}
          onClick={({ key, keyPath }) => {
            const section = keyPath[1];
            if (section === 'topics')   handleSelect('topic',   key);
            else if (section === 'services') handleSelect('service', key);
            else if (section === 'actions')  handleSelect('action',  key);
          }}
        />
      </Sider>

      <Content style={{ padding: 32, overflowY: 'auto', background: '#f5f5f5' }}>
        {active ? (
          <div style={{ maxWidth: 640 }}>
            <Space align="center" style={{ marginBottom: 24 }}>
              {typeTag}
              <Typography.Text style={{ fontSize: 18, fontWeight: 600, fontFamily: 'monospace' }}>
                {active.name}
              </Typography.Text>
            </Space>
            {active.type === 'action' ? (
              <ActionCaller
                schema={active.schema as unknown as import('./ActionCaller').ActionSchema}
                name={active.name}
                serverUrl={serverUrl}
              />
            ) : (
              <RosForm
                schema={active.schema}
                type={active.type as 'topic' | 'service'}
                name={active.name}
                serverUrl={serverUrl}
                onResponse={onResponse}
                onError={onError}
              />
            )}
          </div>
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Space direction="vertical" align="center" style={{ opacity: 0.3 }}>
              <ApartmentOutlined style={{ fontSize: 56, display: 'block' }} />
              <Typography.Text style={{ fontSize: 14 }}>
                {connected ? 'Select a topic or service' : 'Connecting to server…'}
              </Typography.Text>
            </Space>
          </div>
        )}
      </Content>
    </Layout>
  );
}