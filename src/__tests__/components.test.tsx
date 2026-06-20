import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axios from 'axios';

import { RosProvider } from '../components/RosProvider';
import { TopicPublisher } from '../components/TopicPublisher';
import { ServiceCaller } from '../components/ServiceCaller';
import { RosForm } from '../components/Form';
import { RosControlPanel } from '../components/RosControlPanel';

vi.mock('axios');
const ax = vi.mocked(axios);

const STRING_SCHEMA = {
  type: 'object',
  properties: { data: { type: 'string', title: 'data' } },
};

const SETBOOL_SCHEMA = {
  type: 'object',
  properties: { data: { type: 'boolean', title: 'data' } },
};

function wrap(ui: React.ReactElement, url = 'http://localhost:3000') {
  return render(<RosProvider url={url}>{ui}</RosProvider>);
}

// antd Spin v5 does not render tip text in standalone mode —
// detect the spinning container via aria-busy instead.
function getSpinner() {
  return document.querySelector('[aria-busy="true"]');
}

// ── RosProvider ───────────────────────────────────────────────────────

describe('RosProvider', () => {
  it('renders children', () => {
    render(<RosProvider><span>hello</span></RosProvider>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });
});

// ── TopicPublisher ────────────────────────────────────────────────────

describe('TopicPublisher', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows spinner while waiting for schema', () => {
    ax.post.mockReturnValue(new Promise(() => {}));
    wrap(<TopicPublisher topic="/test_topic" />);
    expect(getSpinner()).toBeInTheDocument();
  });

  it('shows title and input field once schema is loaded', async () => {
    ax.post.mockResolvedValue({ data: STRING_SCHEMA });
    wrap(<TopicPublisher topic="/test_topic" />);
    await waitFor(() => expect(screen.getByText('/test_topic')).toBeInTheDocument());
    // RJSF custom TextWidget doesn't forward id, so query by role
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('accepts a custom title prop', async () => {
    ax.post.mockResolvedValue({ data: STRING_SCHEMA });
    wrap(<TopicPublisher topic="/test_topic" title="My Topic" />);
    await waitFor(() => expect(screen.getByText('My Topic')).toBeInTheDocument());
  });

  it('shows error alert when registration fails', async () => {
    ax.post.mockRejectedValue(new Error('connection refused'));
    wrap(<TopicPublisher topic="/bad_topic" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(screen.getByText('connection refused')).toBeInTheDocument();
  });

  it('registers the topic without leading slash', async () => {
    ax.post.mockResolvedValue({ data: STRING_SCHEMA });
    wrap(<TopicPublisher topic="/test_topic" />);
    await waitFor(() =>
      expect(ax.post).toHaveBeenCalledWith(
        'http://localhost:3000/add/topic',
        { name: 'test_topic' },
      ),
    );
  });
});

// ── ServiceCaller ─────────────────────────────────────────────────────

describe('ServiceCaller', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows spinner while waiting for schema', () => {
    ax.post.mockReturnValue(new Promise(() => {}));
    wrap(<ServiceCaller service="/test_set_bool" />);
    expect(getSpinner()).toBeInTheDocument();
  });

  it('shows title and form once schema is loaded', async () => {
    ax.post.mockResolvedValue({ data: SETBOOL_SCHEMA });
    wrap(<ServiceCaller service="/test_set_bool" />);
    await waitFor(() => expect(screen.getByText('/test_set_bool')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('shows error alert when registration fails', async () => {
    ax.post.mockRejectedValue(new Error('service not found'));
    wrap(<ServiceCaller service="/missing" />);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
  });
});

// ── RosForm ───────────────────────────────────────────────────────────

describe('RosForm', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders a text input from a string schema', () => {
    render(
      <RosForm
        schema={STRING_SCHEMA}
        type="topic"
        name="test_topic"
        serverUrl="http://localhost:3000"
      />,
    );
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(
      <RosForm
        schema={STRING_SCHEMA}
        type="topic"
        name="test_topic"
        serverUrl="http://localhost:3000"
      />,
    );
    expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
  });

  it('calls /call/service with correct payload on submit', async () => {
    const user = userEvent.setup();
    ax.post.mockResolvedValue({ data: {} });
    const onResponse = vi.fn();

    render(
      <RosForm
        schema={STRING_SCHEMA}
        type="topic"
        name="test_topic"
        serverUrl="http://localhost:3000"
        onResponse={onResponse}
      />,
    );

    await user.type(screen.getByRole('textbox'), 'hello ros');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() =>
      expect(ax.post).toHaveBeenCalledWith(
        'http://localhost:3000/call/service',
        { type: 'topic', name: 'test_topic', form: { data: 'hello ros' } },
      ),
    );
  });

  it('calls onError when the server returns an error', async () => {
    const user = userEvent.setup();
    const err = new Error('server error');
    ax.post.mockRejectedValue(err);
    const onError = vi.fn();

    render(
      <RosForm
        schema={STRING_SCHEMA}
        type="topic"
        name="test_topic"
        serverUrl="http://localhost:3000"
        onError={onError}
      />,
    );

    await user.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() => expect(onError).toHaveBeenCalledWith(err));
  });
});

// ── RosControlPanel ───────────────────────────────────────────────────

describe('RosControlPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows empty state before a topic or service is selected', async () => {
    ax.get.mockResolvedValue({ data: [] });
    wrap(<RosControlPanel />);
    expect(
      screen.getByText('Select a topic or service from the sidebar'),
    ).toBeInTheDocument();
    // flush pending axios state updates to avoid act() warnings
    await act(async () => {});
  });

  it('renders topic names after expanding the Topics submenu', async () => {
    const user = userEvent.setup();
    ax.get.mockImplementation((url: string) => {
      if (url.endsWith('/topics'))
        return Promise.resolve({ data: [{ name: '/chatter', types: ['std_msgs/msg/String'] }] });
      return Promise.resolve({ data: [] });
    });

    wrap(<RosControlPanel />);

    // Expand the Topics submenu (antd inline menu starts collapsed)
    await waitFor(() => expect(screen.getByText('Topics')).toBeInTheDocument());
    await user.click(screen.getByText('Topics'));

    await waitFor(() => expect(screen.getByText('/chatter')).toBeInTheDocument());
  });

  it('shows the form after clicking a topic item', async () => {
    const user = userEvent.setup();
    ax.get.mockImplementation((url: string) => {
      if (url.endsWith('/topics'))
        return Promise.resolve({ data: [{ name: '/chatter', types: ['std_msgs/msg/String'] }] });
      return Promise.resolve({ data: [] });
    });
    ax.post.mockResolvedValue({ data: STRING_SCHEMA });

    wrap(<RosControlPanel />);

    await waitFor(() => screen.getByText('Topics'));
    await user.click(screen.getByText('Topics'));
    await waitFor(() => screen.getByText('/chatter'));
    await user.click(screen.getByText('/chatter'));

    await waitFor(() =>
      expect(screen.getByText('Publish: chatter')).toBeInTheDocument(),
    );
  });
});