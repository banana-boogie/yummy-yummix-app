/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here as a single source of truth for both modes.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
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

type ChatMode = 'text' | 'voice';

export default function ChatPage() {
    const [mode, setMode] = useState<ChatMode>(Platform.OS === 'web' ? 'text' : 'voice');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [voiceTranscriptMessages, setVoiceTranscriptMessages] = useState<ChatMessage[]>([]);
    const [sessionsMenuOpenSignal, setSessionsMenuOpenSignal] = useState(0);
    const [newChatSignal, setNewChatSignal] = useState(0);

    // Session ID is persisted to AsyncStorage for the resume bar,
    // but NOT restored on mount — users always start with a fresh chat.
    // The ChatResumeBar prompts to continue the previous session.

    // Wrapper that persists sessionId alongside state
    const updateSessionId = useCallback((newSessionId: string) => {
        setSessionId(newSessionId);
        AsyncStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId).catch(() => {});
    }, []);

    const toggleMode = useCallback(() => {
        setMode((m) => (m === 'text' ? 'voice' : 'text'));
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
                                className="mr-md w-10 h-10 rounded-full border-2 border-primary-darkest items-center justify-center"
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <MaterialCommunityIcons
                                    name={mode === 'text' ? 'microphone' : 'keyboard'}
                                    size={22}
                                    color={COLORS.primary.darkest}
                                />
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
