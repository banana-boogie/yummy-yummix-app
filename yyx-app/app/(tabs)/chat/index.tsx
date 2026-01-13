/**
 * Chat Page with Text/Voice Mode Toggle
 * 
 * Users can switch between text chat and voice conversation.
 */

import React, { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { ChatScreen } from '@/components/chat/ChatScreen';
import { VoiceChatScreen } from '@/components/chat/VoiceChatScreen';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';

type ChatMode = 'text' | 'voice';

export default function ChatPage() {
    const [mode, setMode] = useState<ChatMode>('voice'); // Default to voice mode
    const [sessionId, setSessionId] = useState<string | null>(null);

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
                            className="mr-md p-xs"
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <MaterialCommunityIcons
                                name={mode === 'text' ? 'microphone' : 'keyboard'}
                                size={24}
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
                />
            )}
        </View>
    );
}
