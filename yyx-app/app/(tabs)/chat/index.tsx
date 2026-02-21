/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here as a single source of truth for both modes.
 */

import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { VoiceChatScreen } from '@/components/chat/VoiceChatScreen';
import { ChatSessionsMenu } from '@/components/chat/ChatSessionsMenu';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import { ChatMessage } from '@/services/chatService';
import i18n from '@/i18n';

type ChatMode = 'text' | 'voice';

export default function ChatPage() {
    const [mode, setMode] = useState<ChatMode>(Platform.OS === 'web' ? 'text' : 'voice');
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sessionsMenuOpenSignal, setSessionsMenuOpenSignal] = useState(0);
    const [newChatSignal, setNewChatSignal] = useState(0);

    const toggleMode = useCallback(() => {
        setMode((m) => (m === 'text' ? 'voice' : 'text'));
    }, []);

    const handleSelectSession = useCallback((newSessionId: string, sessionMessages: ChatMessage[]) => {
        setSessionId(newSessionId);
        setMessages(sessionMessages);
    }, []);

    const handleNewChat = useCallback(() => {
        setSessionId(null);
        setMessages([]);
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
                    onSessionCreated={setSessionId}
                    transcriptMessages={messages}
                    onTranscriptChange={setMessages}
                />
            ) : (
                <ChatScreen
                    sessionId={sessionId}
                    onSessionCreated={setSessionId}
                    messages={messages}
                    onMessagesChange={setMessages}
                    onOpenSessionsMenu={openSessionsMenu}
                    newChatSignal={newChatSignal}
                />
            )}
        </View>
    );
}
