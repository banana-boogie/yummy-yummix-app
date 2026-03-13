import { useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { QueryClient } from '@tanstack/react-query';
import type { Action, GeneratedRecipe } from '@/types/irmixy';
import type { ChatMessage } from '@/services/chatService';
import { customRecipeService } from '@/services/customRecipeService';
import { customRecipeKeys } from '@/hooks/useCustomRecipe';
import {
    getChatCustomCookingGuidePath,
} from '@/utils/navigation/recipeRoutes';
import {
    executeAction,
    resolveActionContext,
    type ActionContextSource,
} from '@/services/actions/actionRegistry';
import i18n from '@/i18n';

interface UseChatMessageActionsParams {
    setMessages: (update: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
    queryClient: QueryClient;
    /** Live message list for resolving action context */
    getMessages: () => ChatMessage[];
}

export function useChatMessageActions({
    setMessages,
    queryClient,
    getMessages,
}: UseChatMessageActionsParams) {
    const handleCopyMessage = useCallback(async (content: string) => {
        try {
            await Clipboard.setStringAsync(content);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            if (Platform.OS === 'ios') {
                Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'), [{ text: i18n.t('common.ok') }], { userInterfaceStyle: 'unspecified' });
            } else {
                Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'));
            }
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
            let recipeId = savedRecipeId;

            if (!recipeId) {
                const { userRecipeId } = await customRecipeService.save(recipe, finalName);
                recipeId = userRecipeId;

                setMessages(prev => prev.map(msg =>
                    msg.id === messageId
                        ? { ...msg, savedRecipeId: recipeId }
                        : msg
                ));

                await queryClient.invalidateQueries({ queryKey: customRecipeKeys.all });
            }

            if (__DEV__) {
                console.log('[ChatScreen] Starting cooking - recipe ID:', recipeId, 'name:', finalName, 'wasAlreadySaved:', !!savedRecipeId);
            }

            router.push(getChatCustomCookingGuidePath(recipeId));
        } catch (error) {
            if (__DEV__) console.error('Failed to save custom recipe:', error);
            Alert.alert(
                i18n.t('chat.error.title'),
                i18n.t('chat.saveFailed'),
                [{ text: i18n.t('common.ok') }]
            );
        }
    }, [queryClient, setMessages]);

    const handleActionPress = useCallback((action: Action) => {
        const messages = getMessages();
        const context = resolveActionContext(
            messages as ActionContextSource[],
        );
        executeAction(action, context, { source: 'manual', path: 'text' });
    }, [getMessages]);

    return {
        handleCopyMessage,
        handleStartCooking,
        handleActionPress,
    };
}
