import React, { memo } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Text } from '@/components/common/Text';
import { ActionButton } from '@/components/common/ActionButton';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { CustomRecipeCard } from '@/components/chat/CustomRecipeCard';
import { RecipeProgressTracker } from '@/components/chat/RecipeProgressTracker';
import {
    ChatMessage,
    IrmixyStatus,
    GeneratedRecipe,
    Action,
} from '@/services/chatService';
import Markdown from 'react-native-markdown-display';
import { COLORS, FONTS, SPACING, BORDER_RADIUS } from '@/constants/design-tokens';

// ============================================================
// Helpers
// ============================================================

/** Strip markdown image syntax from text (used when recipe cards already show the images). */
function stripMarkdownImages(content: string): string {
    return content.replace(/!\[.*?\]\(.*?\)\s*/g, '').replace(/\n{3,}/g, '\n\n').trim();
}

/** Detect whether content contains markdown syntax worth parsing.
 *  Plain text (e.g. voice transcripts) can skip the expensive Markdown renderer. */
const MARKDOWN_PATTERN = /[#*_`~>|]|\[.+\]\(|^\s*[-+]\s/m;
function hasMarkdownSyntax(content: string): boolean {
    return MARKDOWN_PATTERN.test(content);
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
        marginBottom: SPACING.xs,
        marginTop: SPACING.sm,
        color: COLORS.text.default,
    },
    heading2: {
        fontFamily: FONTS.HEADING,
        fontWeight: '600' as const,
        fontSize: 19,
        marginBottom: SPACING.xxs + 2,
        marginTop: SPACING.xs + 2,
        color: COLORS.text.default,
    },
    heading3: {
        fontFamily: FONTS.HEADING,
        fontWeight: '600' as const,
        fontSize: 17,
        marginBottom: SPACING.xxs,
        marginTop: SPACING.xs,
        color: COLORS.text.default,
    },
    paragraph: {
        marginTop: 0,
        marginBottom: SPACING.sm,
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
        marginBottom: SPACING.xxs,
    },
    bullet_list: {
        marginBottom: SPACING.xs,
        paddingLeft: SPACING.md,
    },
    ordered_list: {
        marginBottom: SPACING.xs,
        paddingLeft: SPACING.md,
    },
    blockquote: {
        borderLeftWidth: 3,
        borderLeftColor: COLORS.primary.medium,
        paddingLeft: SPACING.sm,
        marginVertical: SPACING.xs,
        opacity: 0.9,
    },
    hr: {
        marginVertical: SPACING.md,
        borderBottomWidth: 1,
        borderBottomColor: COLORS.grey.default,
    },
    code_inline: {
        backgroundColor: COLORS.background.secondary,
        paddingHorizontal: SPACING.xxs,
        paddingVertical: SPACING.xxxs,
        borderRadius: BORDER_RADIUS.xs,
        fontFamily: 'monospace',
    },
    code_block: {
        backgroundColor: COLORS.background.secondary,
        padding: SPACING.xs,
        borderRadius: BORDER_RADIUS.sm,
        marginBottom: SPACING.xs,
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
    isRecipeGenerating?: boolean;
    currentStatus: IrmixyStatus;
    statusText: string;
    /** Show Irmixy avatar next to assistant messages */
    showAvatar?: boolean;
    onCopyMessage: (content: string) => void;
    onStartCooking: (recipe: GeneratedRecipe, finalName: string, messageId: string, savedRecipeId?: string) => Promise<void>;
    onActionPress: (action: Action, messageId: string) => void;
}

export const ChatMessageItem = memo(function ChatMessageItem({
    item,
    isLastMessage,
    isLoading,
    isRecipeGenerating = false,
    currentStatus,
    statusText,
    showAvatar = false,
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
                    <View className="max-w-[85%] flex-row items-end gap-xs self-start">
                        {showAvatar && (
                            <Image
                                source={require('@/assets/images/irmixy-avatar/irmixy-face.png')}
                                style={{ width: 24, height: 24 }}
                                contentFit="contain"
                            />
                        )}
                        <Pressable
                            onLongPress={() => onCopyMessage(item.content)}
                            className="flex-1 p-sm rounded-lg bg-background-secondary"
                        >
                            {hasMarkdownSyntax(displayContent) ? (
                                <Markdown style={markdownStyles}>
                                    {displayContent}
                                </Markdown>
                            ) : (
                                <Text className="text-base leading-relaxed text-text-default">
                                    {displayContent}
                                </Text>
                            )}
                        </Pressable>
                    </View>
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

            {/* Action buttons */}
            {!isUser && item.actions && item.actions.length > 0 && (
                <View className="mt-xs gap-xs">
                    {item.actions.map((action) => (
                        <ActionButton
                            key={action.id}
                            label={action.label}
                            onPress={() => onActionPress(action, item.id)}
                        />
                    ))}
                </View>
            )}
        </View>
    );
});
