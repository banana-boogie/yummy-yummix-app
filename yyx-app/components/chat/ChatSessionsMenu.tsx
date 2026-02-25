/**
 * ChatSessionsMenu Component
 *
 * Hamburger menu that shows chat sessions and allows switching or starting new chats.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, TouchableOpacity, Modal, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/common/Text';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { loadChatSessions, loadChatHistory } from '@/services/chatService';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import * as Haptics from 'expo-haptics';
import type { ChatMessage } from '@/services/chatService';

interface ChatSession {
    id: string;
    title: string;
    createdAt: Date;
}

interface ChatSessionsMenuProps {
    currentSessionId: string | null;
    onSelectSession: (sessionId: string, messages: ChatMessage[]) => void;
    onNewChat: () => void;
    openSignal?: number;
}

export function ChatSessionsMenu({
    currentSessionId,
    onSelectSession,
    onNewChat,
    openSignal,
}: ChatSessionsMenuProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingSessionId, setLoadingSessionId] = useState<string | null>(null);
    const prevOpenSignalRef = useRef<number | undefined>(openSignal);

    const loadSessions = useCallback(async () => {
        setIsLoading(true);
        try {
            const data = await loadChatSessions();
            setSessions(data);
        } catch (err) {
            if (__DEV__) console.error('Failed to load chat sessions:', err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadSessions();
        }
    }, [isOpen, loadSessions]);

    useEffect(() => {
        if (
            openSignal !== undefined &&
            prevOpenSignalRef.current !== undefined &&
            openSignal !== prevOpenSignalRef.current
        ) {
            setIsOpen(true);
        }
        prevOpenSignalRef.current = openSignal;
    }, [openSignal]);

    const handleOpen = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setIsOpen(true);
    }, []);

    const handleClose = useCallback(() => {
        setIsOpen(false);
    }, []);

    const handleNewChat = useCallback(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsOpen(false);
        onNewChat();
    }, [onNewChat]);

    const handleSelectSession = useCallback(async (session: ChatSession) => {
        if (session.id === currentSessionId) {
            setIsOpen(false);
            return;
        }

        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLoadingSessionId(session.id);

        try {
            const messages = await loadChatHistory(session.id);
            setIsOpen(false);
            onSelectSession(session.id, messages);
        } catch (err) {
            if (__DEV__) console.error('Failed to load session:', err);
        } finally {
            setLoadingSessionId(null);
        }
    }, [currentSessionId, onSelectSession]);

    const formatDate = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (days === 0) return i18n.t('common.today');
        if (days === 1) return i18n.t('common.yesterday');
        if (days < 7) return i18n.t('common.daysAgo', { count: days });
        return date.toLocaleDateString();
    };

    return (
        <>
            {/* Hamburger Button */}
            <TouchableOpacity
                onPress={handleOpen}
                className="w-10 h-10 items-center justify-center rounded-full bg-background-secondary ml-md"
                accessibilityLabel={i18n.t('chat.sessions.menuLabel')}
                accessibilityRole="button"
            >
                <MaterialCommunityIcons name="menu" size={24} color={COLORS.text.default} />
            </TouchableOpacity>

            {/* Sessions Modal */}
            <Modal
                visible={isOpen}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
            >
                <Pressable
                    className="flex-1 bg-black/50"
                    onPress={handleClose}
                >
                    <Pressable
                        className="absolute top-20 left-4 right-4 bg-white rounded-xl shadow-lg max-h-[70%]"
                        onPress={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <View className="flex-row items-center justify-between p-md border-b border-border-default">
                            <Text className="text-lg font-semibold text-text-primary">
                                {i18n.t('chat.sessions.title')}
                            </Text>
                            <TouchableOpacity onPress={handleClose}>
                                <MaterialCommunityIcons name="close" size={24} color={COLORS.grey.medium} />
                            </TouchableOpacity>
                        </View>

                        {/* New Chat Button */}
                        <TouchableOpacity
                            onPress={handleNewChat}
                            className="flex-row items-center p-md border-b border-border-default bg-primary-lightest"
                        >
                            <MaterialCommunityIcons name="plus-circle" size={24} color={COLORS.primary.darkest} />
                            <Text className="ml-sm text-primary-darkest font-semibold">
                                {i18n.t('chat.sessions.newChat')}
                            </Text>
                        </TouchableOpacity>

                        {/* Sessions List */}
                        {isLoading ? (
                            <View className="p-lg items-center">
                                <ActivityIndicator color={COLORS.primary.default} />
                            </View>
                        ) : sessions.length === 0 ? (
                            <View className="p-lg items-center">
                                <Text className="text-text-secondary">
                                    {i18n.t('chat.sessions.noSessions')}
                                </Text>
                            </View>
                        ) : (
                            <View className="max-h-80">
                                {sessions.map((session) => (
                                    <TouchableOpacity
                                        key={session.id}
                                        onPress={() => handleSelectSession(session)}
                                        className={`flex-row items-center p-md border-b border-border-default ${
                                            session.id === currentSessionId ? 'bg-primary-lightest' : ''
                                        }`}
                                        disabled={loadingSessionId === session.id}
                                    >
                                        <MaterialCommunityIcons
                                            name="chat-outline"
                                            size={20}
                                            color={session.id === currentSessionId ? COLORS.primary.darkest : COLORS.grey.medium}
                                        />
                                        <View className="flex-1 ml-sm">
                                            <Text
                                                className={`${session.id === currentSessionId ? 'text-primary-darkest font-semibold' : 'text-text-primary'}`}
                                                numberOfLines={1}
                                            >
                                                {session.title}
                                            </Text>
                                            <Text className="text-text-tertiary text-xs">
                                                {formatDate(session.createdAt)}
                                            </Text>
                                        </View>
                                        {loadingSessionId === session.id && (
                                            <ActivityIndicator size="small" color={COLORS.primary.default} />
                                        )}
                                        {session.id === currentSessionId && !loadingSessionId && (
                                            <MaterialCommunityIcons name="check" size={20} color={COLORS.primary.darkest} />
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}
                    </Pressable>
                </Pressable>
            </Modal>
        </>
    );
}
