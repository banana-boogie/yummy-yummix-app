/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here to preserve recipes when switching modes.
 * Voice transcript messages are also lifted for mode-switch persistence.
 */

import React, { useState, useCallback } from 'react';
import { View, TouchableOpacity } from 'react-native';
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
    const [mode, setMode] = useState<ChatMode>('voice'); // Default to voice mode
    const [sessionId, setSessionId] = useState<string | null>(null);
    // Lift messages state to preserve recipes when switching modes
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // Lift voice transcript messages for mode-switch persistence
    const [voiceTranscriptMessages, setVoiceTranscriptMessages] = useState<ChatMessage[]>([]);

    const toggleMode = () => {
        setMode(m => m === 'text' ? 'voice' : 'text');
    };

    // Handler for selecting a session from the hamburger menu
    const handleSelectSession = useCallback((newSessionId: string, sessionMessages: ChatMessage[]) => {
        setSessionId(newSessionId);
        setMessages(sessionMessages);
    }, []);

    // Handler for starting a new chat from the hamburger menu
    const handleNewChat = useCallback(() => {
        setSessionId(null);
        setMessages([]);
        setVoiceTranscriptMessages([]);
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
                    headerRight: () => (
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
                    ),
                }}
            />
            {mode === 'voice' ? (
                <VoiceChatScreen
                    sessionId={sessionId}
                    onSessionCreated={setSessionId}
                    transcriptMessages={voiceTranscriptMessages}
                    onTranscriptChange={setVoiceTranscriptMessages}
                />
            ) : (
                <ChatScreen
                    sessionId={sessionId}
                    onSessionCreated={setSessionId}
                    messages={messages}
                    onMessagesChange={setMessages}
                />
            )}
        </View>
    );
}
