/**
 * Chat Page with Text/Voice Mode Toggle
 *
 * Users can switch between text chat and voice conversation.
 * Messages state is lifted here to preserve recipes when switching modes.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { VoiceChatScreen } from '@/components/chat/VoiceChatScreen';
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

    const toggleMode = () => {
        setMode(m => m === 'text' ? 'voice' : 'text');
    };

    return (
        <View className="flex-1 bg-background-default">
            <Stack.Screen
                options={{
                    title: i18n.t('chat.title'),
                    headerShown: true,
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
