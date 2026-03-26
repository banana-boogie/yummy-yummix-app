/**
 * ChatSessionsMenu Component Tests
 *
 * Tests for the hamburger menu that shows chat sessions and allows
 * switching between sessions or starting a new chat.
 */

import React from 'react';
import { renderWithProviders, screen, fireEvent, waitFor } from '@/test/utils/render';
import { ChatSessionsMenu } from '../ChatSessionsMenu';

// ============================================================
// MOCKS
// ============================================================

const mockLoadChatSessions = jest.fn();
const mockLoadChatHistory = jest.fn();

jest.mock('@/services/chatService', () => ({
  loadChatSessions: (...args: unknown[]) => mockLoadChatSessions(...args),
  loadChatHistory: (...args: unknown[]) => mockLoadChatHistory(...args),
}));

jest.mock('@/i18n', () => ({
  t: (key: string) => {
    const translations: Record<string, string> = {
      'chat.sessions.menuLabel': 'Chat sessions',
      'chat.sessions.historyLabel': 'History',
      'chat.sessions.title': 'Chat Sessions',
      'chat.sessions.newChat': 'New Chat',
      'chat.sessions.noSessions': 'No sessions yet',
      'common.today': 'Today',
      'common.yesterday': 'Yesterday',
    };
    return translations[key] || key;
  },
}));

// ============================================================
// HELPERS
// ============================================================

const createDefaultProps = (overrides?: Partial<React.ComponentProps<typeof ChatSessionsMenu>>) => ({
  currentSessionId: null as string | null,
  onSelectSession: jest.fn(),
  onNewChat: jest.fn(),
  ...overrides,
});

function createSession(overrides: Partial<{ id: string; title: string; createdAt: Date }> = {}) {
  return {
    id: overrides.id ?? 'session-1',
    title: overrides.title ?? 'Test Session',
    createdAt: overrides.createdAt ?? new Date(),
  };
}

// ============================================================
// TESTS
// ============================================================

describe('ChatSessionsMenu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadChatSessions.mockResolvedValue([]);
    mockLoadChatHistory.mockResolvedValue([]);
  });

  it('renders the menu trigger button with history label', () => {
    const props = createDefaultProps();

    renderWithProviders(<ChatSessionsMenu {...props} />);

    expect(screen.getByText('History')).toBeTruthy();
    expect(screen.getByLabelText('Chat sessions')).toBeTruthy();
  });

  it('opens modal and loads sessions when trigger is pressed', async () => {
    const sessions = [
      createSession({ id: 'sess-1', title: 'Pasta recipe chat' }),
      createSession({ id: 'sess-2', title: 'Dessert ideas' }),
    ];
    mockLoadChatSessions.mockResolvedValue(sessions);
    const props = createDefaultProps();

    renderWithProviders(<ChatSessionsMenu {...props} />);

    fireEvent.press(screen.getByText('History'));

    await waitFor(() => {
      expect(screen.getByText('Chat Sessions')).toBeTruthy();
    });
    expect(mockLoadChatSessions).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('Pasta recipe chat')).toBeTruthy();
      expect(screen.getByText('Dessert ideas')).toBeTruthy();
    });
  });

  it('shows empty state when no sessions exist', async () => {
    mockLoadChatSessions.mockResolvedValue([]);
    const props = createDefaultProps();

    renderWithProviders(<ChatSessionsMenu {...props} />);

    fireEvent.press(screen.getByText('History'));

    await waitFor(() => {
      expect(screen.getByText('No sessions yet')).toBeTruthy();
    });
  });

  it('calls onNewChat when new chat button is pressed', async () => {
    mockLoadChatSessions.mockResolvedValue([]);
    const props = createDefaultProps();

    renderWithProviders(<ChatSessionsMenu {...props} />);

    fireEvent.press(screen.getByText('History'));

    await waitFor(() => {
      expect(screen.getByText('New Chat')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('New Chat'));

    expect(props.onNewChat).toHaveBeenCalledTimes(1);
  });

  it('calls onSelectSession with loaded messages when a session is selected', async () => {
    const sessions = [
      createSession({ id: 'sess-1', title: 'Pasta recipe chat' }),
    ];
    const mockMessages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    mockLoadChatSessions.mockResolvedValue(sessions);
    mockLoadChatHistory.mockResolvedValue(mockMessages);
    const props = createDefaultProps();

    renderWithProviders(<ChatSessionsMenu {...props} />);

    fireEvent.press(screen.getByText('History'));

    await waitFor(() => {
      expect(screen.getByText('Pasta recipe chat')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Pasta recipe chat'));

    await waitFor(() => {
      expect(mockLoadChatHistory).toHaveBeenCalledWith('sess-1');
      expect(props.onSelectSession).toHaveBeenCalledWith('sess-1', mockMessages);
    });
  });

  it('does not load history when selecting the current session', async () => {
    const sessions = [
      createSession({ id: 'current-sess', title: 'Current chat' }),
    ];
    mockLoadChatSessions.mockResolvedValue(sessions);
    const props = createDefaultProps({ currentSessionId: 'current-sess' });

    renderWithProviders(<ChatSessionsMenu {...props} />);

    fireEvent.press(screen.getByText('History'));

    await waitFor(() => {
      expect(screen.getByText('Current chat')).toBeTruthy();
    });

    fireEvent.press(screen.getByText('Current chat'));

    expect(mockLoadChatHistory).not.toHaveBeenCalled();
    expect(props.onSelectSession).not.toHaveBeenCalled();
  });
});
