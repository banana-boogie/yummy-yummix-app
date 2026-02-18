import React, { memo } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { CustomRecipeCard } from '@/components/chat/CustomRecipeCard';
import { RecipeGeneratingSkeleton } from '@/components/chat/RecipeGeneratingSkeleton';
import {
    ChatMessage,
    IrmixyStatus,
    GeneratedRecipe,
    QuickAction,
} from '@/services/chatService';
import Markdown from 'react-native-markdown-display';
import { COLORS } from '@/constants/design-tokens';

// ============================================================
// Helpers
// ============================================================

/** Strip markdown image syntax from text (used when recipe cards already show the images). */
function stripMarkdownImages(content: string): string {
    return content.replace(/!\[.*?\]\(.*?\)\n*/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

// ============================================================
// Markdown Styles
// ============================================================

export const markdownStyles = {
    body: {
        color: COLORS.text.default,
        fontSize: 16,
        lineHeight: 24,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 8,
    },
    strong: {
        fontWeight: '600' as const,
    },
    em: {
        fontStyle: 'italic' as const,
    },
    list_item: {
        marginBottom: 4,
    },
    bullet_list: {
        marginBottom: 8,
    },
    ordered_list: {
        marginBottom: 8,
    },
    code_inline: {
        backgroundColor: COLORS.background.secondary,
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontFamily: 'monospace',
    },
    code_block: {
        backgroundColor: COLORS.background.secondary,
        padding: 8,
        borderRadius: 8,
        marginBottom: 8,
        fontFamily: 'monospace',
    },
    link: {
        color: COLORS.primary.darkest,
        textDecorationLine: 'underline' as const,
    },
};

// ============================================================
// ChatMessageItem Component
// ============================================================

export interface ChatMessageItemProps {
    item: ChatMessage;
    isLastMessage: boolean;
    isLoading: boolean;
    currentStatus: IrmixyStatus;
    statusText: string;
    onCopyMessage: (content: string) => void;
    onStartCooking: (recipe: GeneratedRecipe, finalName: string, messageId: string, savedRecipeId?: string) => void;
    onActionPress: (action: QuickAction) => void;
    onConfirmAllergen?: (messageId: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
    item,
    isLastMessage,
    isLoading,
    currentStatus,
    statusText,
    onCopyMessage,
    onStartCooking,
    onActionPress,
    onConfirmAllergen,
}: ChatMessageItemProps) {
    const isUser = item.role === 'user';
    const showRecipeSkeleton = !isUser && !item.customRecipe && isLoading
        && (currentStatus === 'generating' || currentStatus === 'enriching') && isLastMessage;
    const hasRecipeVisualData = !isUser && (
        (item.recipes?.length ?? 0) > 0 || !!item.customRecipe
    );

    // Strip markdown images only when recipe visuals are rendered as cards.
    // If there are no cards, keep markdown images in the message bubble.
    const displayContent = !isUser
        ? (hasRecipeVisualData ? stripMarkdownImages(item.content) : item.content)
        : item.content;

    return (
        <View className="mb-sm">
            {/* TEXT MESSAGE BUBBLE (first — provides context before cards) */}
            {displayContent && displayContent.trim().length > 0 && (
                isUser ? (
                    <TouchableOpacity
                        onLongPress={() => onCopyMessage(item.content)}
                        activeOpacity={0.7}
                        className="max-w-[80%] p-sm rounded-lg self-end bg-primary-default"
                    >
                        <Text className="text-base leading-relaxed text-white">
                            {item.content}
                        </Text>
                    </TouchableOpacity>
                ) : (
                    <Pressable
                        onLongPress={() => onCopyMessage(item.content)}
                        className="max-w-[80%] p-sm rounded-lg self-start bg-background-secondary"
                    >
                        <Markdown style={markdownStyles}>
                            {displayContent}
                        </Markdown>
                    </Pressable>
                )
            )}

            {/* Recipe cards (after text so the message provides context) */}
            {!isUser && item.recipes && item.recipes.length > 0 && (
                <View className="mt-sm w-full gap-md">
                    {item.recipes.map((recipe) => (
                        <ChatRecipeCard key={recipe.recipeId} recipe={recipe} />
                    ))}
                </View>
            )}

            {/* Custom recipe card (for AI-generated recipes) */}
            {!isUser && item.customRecipe && (
                <View className="mt-sm w-full">
                    <CustomRecipeCard
                        recipe={item.customRecipe}
                        safetyFlags={item.safetyFlags}
                        onStartCooking={onStartCooking}
                        messageId={item.id}
                        savedRecipeId={item.savedRecipeId}
                        onConfirmAllergen={onConfirmAllergen ? () => onConfirmAllergen(item.id) : undefined}
                    />
                </View>
            )}

            {/* Show skeleton while generating/enriching recipe */}
            {showRecipeSkeleton && (
                <View className="mt-sm w-full">
                    <RecipeGeneratingSkeleton statusMessage={statusText} />
                </View>
            )}

            {/* Quick action buttons */}
            {!isUser && item.actions && item.actions.length > 0 && (
                <View className="mt-xs gap-xs">
                    {item.actions.map((action, idx) => (
                        <TouchableOpacity
                            key={`${action.type}-${idx}`}
                            onPress={() => onActionPress(action)}
                            className="self-start bg-primary-medium px-md py-xs rounded-lg"
                        >
                            <Text className="text-sm font-medium text-white">
                                {action.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
});
