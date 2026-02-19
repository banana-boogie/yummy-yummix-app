import React, { useMemo, memo } from 'react';
import { View, TouchableOpacity, Pressable } from 'react-native';
import { Text } from '@/components/common/Text';
import { ChatRecipeCard } from '@/components/chat/ChatRecipeCard';
import { CustomRecipeCard } from '@/components/chat/CustomRecipeCard';
import { RecipeGeneratingSkeleton } from '@/components/chat/RecipeGeneratingSkeleton';
import {
    ChatMessage,
    IrmixyStatus,
    RecipeCard,
    GeneratedRecipe,
    Action,
} from '@/services/chatService';
import { Image } from 'expo-image';
import Markdown from 'react-native-markdown-display';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { COLORS } from '@/constants/design-tokens';

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
    image: {
        width: 200,
        height: 150,
        borderRadius: 8,
        marginVertical: 8,
    },
};

// ============================================================
// Markdown Rules
// ============================================================

const markdownRulesCache = new WeakMap<RecipeCard[], ReturnType<typeof createMarkdownRulesImpl>>();

function createMarkdownRulesImpl(recipes?: RecipeCard[]) {
    return {
        image: (node: any, _children: any, _parent: any, styles: any) => {
            const { src } = node.attributes;

            // Try to find matching recipe by image URL
            const matchingRecipe = recipes?.find(r => r.imageUrl === src);

            const imageElement = (
                <Image
                    key={node.key}
                    source={{ uri: src }}
                    style={styles.image}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={0}
                    placeholder={null}
                />
            );

            // If we found a matching recipe, make the image clickable
            if (matchingRecipe?.recipeId) {
                return (
                    <TouchableOpacity
                        key={node.key}
                        onPress={() => {
                            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            router.push(`/(tabs)/recipes/${matchingRecipe.recipeId}?from=chat`);
                        }}
                        activeOpacity={0.8}
                    >
                        {imageElement}
                    </TouchableOpacity>
                );
            }

            return imageElement;
        },
    };
}

export function createMarkdownRules(recipes?: RecipeCard[]) {
    if (!recipes) return createMarkdownRulesImpl(undefined);
    let cached = markdownRulesCache.get(recipes);
    if (!cached) {
        cached = createMarkdownRulesImpl(recipes);
        markdownRulesCache.set(recipes, cached);
    }
    return cached;
}

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
    onActionPress: (action: Action) => void;
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
}: ChatMessageItemProps) {
    const isUser = item.role === 'user';
    const showRecipeSkeleton = !isUser && !item.customRecipe && isLoading
        && (currentStatus === 'generating' || currentStatus === 'enriching') && isLastMessage;

    // Memoize markdown rules for this message's recipes
    const markdownRules = useMemo(
        () => createMarkdownRules(item.recipes),
        [item.recipes]
    );

    return (
        <View className="mb-sm">
            {/* RECIPE CARDS FIRST (for assistant messages) */}
            {!isUser && item.recipes && item.recipes.length > 0 && (
                <View className="mb-sm w-full">
                    {item.recipes.map((recipe) => (
                        <ChatRecipeCard key={recipe.recipeId} recipe={recipe} />
                    ))}
                </View>
            )}

            {/* Custom recipe card (for AI-generated recipes) */}
            {!isUser && item.customRecipe && (
                <View className="mb-sm w-full">
                    <CustomRecipeCard
                        recipe={item.customRecipe}
                        safetyFlags={item.safetyFlags}
                        onStartCooking={onStartCooking}
                        messageId={item.id}
                        savedRecipeId={item.savedRecipeId}
                    />
                </View>
            )}

            {/* Show skeleton while generating/enriching recipe - stays visible until customRecipe is populated */}
            {showRecipeSkeleton && (
                <View className="mb-sm w-full">
                    <RecipeGeneratingSkeleton statusMessage={statusText} />
                </View>
            )}

            {/* TEXT MESSAGE BUBBLE (after cards) */}
            {item.content && item.content.trim().length > 0 && (
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
                    // Use Pressable for assistant messages to allow individual image touches
                    <Pressable
                        onLongPress={() => onCopyMessage(item.content)}
                        className="max-w-[80%] p-sm rounded-lg self-start bg-background-secondary"
                    >
                        <Markdown
                            style={markdownStyles}
                            rules={markdownRules}
                        >
                            {item.content}
                        </Markdown>
                    </Pressable>
                )
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
