/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here as a single source of truth for both modes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Text } from '@/components/common/Text';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Stack } from 'expo-router';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { VoiceChatScreen } from '@/components/chat/VoiceChatScreen';
import { ChatSessionsMenu } from '@/components/chat/ChatSessionsMenu';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ChatMessage } from '@/services/chatService';
import i18n from '@/i18n';

const STORAGE_KEY_SESSION_ID = 'lastChatSessionId';
const STORAGE_KEY_CHAT_MODE = 'lastChatMode';

type ChatMode = 'text' | 'voice';

const DEFAULT_MODE: ChatMode = Platform.OS === 'web' ? 'text' : 'text';

export default function ChatPage() {
    const [mode, setMode] = useState<ChatMode>(DEFAULT_MODE);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [voiceTranscriptMessages, setVoiceTranscriptMessages] = useState<ChatMessage[]>([]);
    const [sessionsMenuOpenSignal, setSessionsMenuOpenSignal] = useState(0);
    const [newChatSignal, setNewChatSignal] = useState(0);

    // Restore last-used chat mode on mount
    useEffect(() => {
        if (Platform.OS === 'web') return;
        AsyncStorage.getItem(STORAGE_KEY_CHAT_MODE).then((stored) => {
            if (stored === 'text' || stored === 'voice') setMode(stored);
        }).catch(() => {});
    }, []);

    // Session ID is persisted to AsyncStorage for the resume bar,
    // but NOT restored on mount — users always start with a fresh chat.
    // The ChatResumeBar prompts to continue the previous session.

    // Wrapper that persists sessionId alongside state
    const updateSessionId = useCallback((newSessionId: string) => {
        setSessionId(newSessionId);
        AsyncStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId).catch(() => {});
    }, []);

    const toggleMode = useCallback(() => {
        setMode((m) => {
            const next = m === 'text' ? 'voice' : 'text';
            AsyncStorage.setItem(STORAGE_KEY_CHAT_MODE, next).catch(() => {});
            return next;
        });
    }, []);

    const handleSelectSession = useCallback((newSessionId: string, sessionMessages: ChatMessage[]) => {
        updateSessionId(newSessionId);
        setMessages(sessionMessages);
        setVoiceTranscriptMessages(sessionMessages);
    }, [updateSessionId]);

    const handleNewChat = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setVoiceTranscriptMessages([]);
        AsyncStorage.removeItem(STORAGE_KEY_SESSION_ID).catch(() => {});
        setNewChatSignal((prev) => prev + 1);
    }, []);

    const openSessionsMenu = useCallback(() => {
        setSessionsMenuOpenSignal((prev) => prev + 1);
    }, []);

    return (
        <View className="flex-1 bg-background-default">
            <Stack.Screen
                options={{
                    title: i18n.t('chat.title'),
                    headerShown: true,
                    headerLeft: () => (
                        <ChatSessionsMenu
                            currentSessionId={sessionId}
                            onSelectSession={handleSelectSession}
                            onNewChat={handleNewChat}
                            openSignal={sessionsMenuOpenSignal}
                        />
                    ),
                    headerRight: () =>
                        Platform.OS !== 'web' ? (
                            <TouchableOpacity
                                onPress={toggleMode}
                                className="flex-row items-center gap-xs px-sm py-xs"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons
                                    name={mode === 'text' ? 'microphone' : 'keyboard'}
                                    size={20}
                                    color={COLORS.primary.darkest}
                                />
                                <Text className="text-primary-darkest text-sm font-medium">
                                    {mode === 'text'
                                        ? i18n.t('chat.modeLabel.voice')
                                        : i18n.t('chat.modeLabel.text')}
                                </Text>
                            </TouchableOpacity>
                        ) : undefined,
                }}
            />
            {mode === 'voice' ? (
                <VoiceChatScreen
                    sessionId={sessionId}
                    onSessionCreated={updateSessionId}
                    transcriptMessages={voiceTranscriptMessages}
                    onTranscriptChange={setVoiceTranscriptMessages}
                />
            ) : (
                <ChatScreen
                    sessionId={sessionId}
                    onSessionCreated={updateSessionId}
                    messages={messages}
                    onMessagesChange={setMessages}
                    onOpenSessionsMenu={openSessionsMenu}
                    newChatSignal={newChatSignal}
                />
            )}
        </View>
    );
}
