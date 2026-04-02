import { useCallback } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import type { Action, GeneratedRecipe } from '@/types/irmixy';
import type { ChatMessage } from '@/services/chatService';
import { customRecipeKeys } from '@/hooks/useCustomRecipe';
import {
    executeAction,
    resolveActionContext,
    type ActionContextSource,
} from '@/services/actions/actionRegistry';
import i18n from '@/i18n';
import { copyMessageToClipboard } from '@/utils/chat/copyMessage';
import { saveAndGetCookingPath } from '@/utils/chat/startCooking';

interface UseChatMessageActionsParams {
    setMessages: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    queryClient: QueryClient;
    /** Live message list for resolving action context */
    getMessages: () => ChatMessage[];
    /** Called before navigating away (e.g. dismiss a modal before pushing a route) */
    onNavigateAway?: () => void;
    /** Current chat session ID — threaded to cooking guide so it can return to this session */
    chatSessionId?: string | null;
}

export function useChatMessageActions({
    setMessages,
    queryClient,
    getMessages,
    onNavigateAway,
    chatSessionId,
}: UseChatMessageActionsParams) {
    const handleCopyMessage = useCallback(async (content: string) => {
        try {
            await copyMessageToClipboard(content);
        } catch (error) {
            if (__DEV__) console.error('Failed to copy message:', error);
        }
    }, []);

    const handleStartCooking = useCallback(async (
        recipe: GeneratedRecipe,
        finalName: string,
        messageId: string,
        savedRecipeId?: string
    ) => {
        try {
            const result = await saveAndGetCookingPath(recipe, finalName, savedRecipeId, chatSessionId);

            if (result.wasNewlySaved) {
                setMessages(prev => prev.map(msg =>
                    msg.id === messageId
                        ? { ...msg, savedRecipeId: result.recipeId }
                        : msg
                ));

                await queryClient.invalidateQueries({ queryKey: customRecipeKeys.all });
            }

            onNavigateAway?.();
            router.push(result.path);
        } catch (error) {
            if (__DEV__) console.error('Failed to save custom recipe:', error);
            Alert.alert(
                i18n.t('chat.error.title'),
                i18n.t('chat.saveFailed'),
                [{ text: i18n.t('common.ok') }]
            );
        }
    }, [queryClient, setMessages, onNavigateAway, chatSessionId]);

    const handleActionPress = useCallback((action: Action, messageId: string) => {
        const messages = getMessages();
        const context = resolveActionContext(
            messages as ActionContextSource[],
            messageId,
        );
        executeAction(action, context, { source: 'manual', path: 'text' });
    }, [getMessages]);

    return {
        handleCopyMessage,
        handleStartCooking,
        handleActionPress,
    };
}
