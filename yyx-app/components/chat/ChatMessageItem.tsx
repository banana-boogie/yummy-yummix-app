import React, { memo } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { CustomRecipeCard } from '@/components/chat/CustomRecipeCard';
import { RecipeProgressTracker } from '@/components/chat/RecipeProgressTracker';
import {
    ChatMessage,
    IrmixyStatus,
    GeneratedRecipe,
    QuickAction,
} from '@/services/chatService';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS } from '@/constants/design-tokens';

// ============================================================
// Helpers
// ============================================================

/** Strip markdown image syntax from text (used when recipe cards already show the images). */
function stripMarkdownImages(content: string): string {
    return content.replace(/!\[.*?\]\(.*?\)\s*/g, '').replace(/\n{3,}/g, '\n\n').trim();
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
    heading1: {
        fontFamily: FONTS.HEADING,
        fontWeight: '700' as const,
        fontSize: 22,
        marginBottom: 8,
        marginTop: 12,
        color: COLORS.text.default,
    },
    heading2: {
        fontFamily: FONTS.HEADING,
        fontWeight: '600' as const,
        fontSize: 19,
        marginBottom: 6,
        marginTop: 10,
        color: COLORS.text.default,
    },
    heading3: {
        fontFamily: FONTS.HEADING,
        fontWeight: '600' as const,
        fontSize: 17,
        marginBottom: 4,
        marginTop: 8,
        color: COLORS.text.default,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: 12,
        lineHeight: 22,
    },
    strong: {
        fontWeight: '700' as const,
        color: COLORS.text.default,
    },
    em: {
        fontStyle: 'italic' as const,
    },
    list_item: {
        marginBottom: 4,
    },
    bullet_list: {
        marginBottom: 8,
        paddingLeft: 16,
    },
    ordered_list: {
        marginBottom: 8,
        paddingLeft: 16,
    },
    blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary.medium,
        paddingLeft: 12,
        marginVertical: 8,
        opacity: 0.9,
    },
    hr: {
        marginVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grey.default,
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
    isRecipeGenerating: boolean;
    currentStatus: IrmixyStatus;
    statusText: string;
    onCopyMessage: (content: string) => void;
    onStartCooking: (recipe: GeneratedRecipe, finalName: string, messageId: string, savedRecipeId?: string) => Promise<void>;
    onActionPress: (action: QuickAction) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
    item,
    isLastMessage,
    isLoading,
    isRecipeGenerating,
    currentStatus,
    statusText,
    onCopyMessage,
    onStartCooking,
    onActionPress,
}: ChatMessageItemProps) {
    const isUser = item.role === 'user';
    const showRecipeTracker = !isUser && isRecipeGenerating && !item.customRecipe && isLastMessage;
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
                        compact={true}
                    />
                </View>
            )}

            {/* Recipe progress tracker (replaces skeleton during generation) */}
            {showRecipeTracker && (
                <View className="mt-sm w-full">
                    <RecipeProgressTracker
                        currentStatus={currentStatus}
                        isActive={showRecipeTracker}
                        hasRecipe={!!item.customRecipe}
                    />
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
