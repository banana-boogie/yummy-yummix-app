/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here to preserve recipes when switching modes.
 * Voice transcript messages are also lifted for mode-switch persistence.
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
    const [mode, setMode] = useState<ChatMode>(Platform.OS === 'web' ? 'text' : 'voice'); // Default to text on web, voice on mobile
    const [sessionId, setSessionId] = useState<string | null>(null);
    // Lift messages state to preserve recipes when switching modes
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // Lift voice transcript messages for mode-switch persistence
    const [voiceTranscriptMessages, setVoiceTranscriptMessages] = useState<ChatMessage[]>([]);

    // Restore persisted sessionId on mount
    useEffect(() => {
        AsyncStorage.getItem(STORAGE_KEY_SESSION_ID).then((stored) => {
            if (stored) setSessionId(stored);
        }).catch(() => { /* ignore storage errors */ });
    }, []);

    // Wrapper that persists sessionId alongside state
    const updateSessionId = useCallback((newSessionId: string) => {
        setSessionId(newSessionId);
        AsyncStorage.setItem(STORAGE_KEY_SESSION_ID, newSessionId).catch(() => {});
    }, []);

    const toggleMode = () => {
        setMode(m => m === 'text' ? 'voice' : 'text');
    };

    // Handler for selecting a session from the hamburger menu
    const handleSelectSession = useCallback((newSessionId: string, sessionMessages: ChatMessage[]) => {
        updateSessionId(newSessionId);
        setMessages(sessionMessages);
    }, [updateSessionId]);

    // Handler for starting a new chat from the hamburger menu
    const handleNewChat = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setVoiceTranscriptMessages([]);
        AsyncStorage.removeItem(STORAGE_KEY_SESSION_ID).catch(() => {});
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
                />
            )}
        </View>
    );
}
