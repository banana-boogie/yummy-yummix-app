/**
 * IrmixyHomeActions
 *
 * Action cards rendered in the chat empty state.
 *
 * NOTE: Active-plan detection is not yet reliable — `get_current_plan` is a
 * stub in the meal-planner edge function (PR #1) that always returns
 * `{ plan: null }`. Until a real implementation lands, this component only
 * renders the no-plan card set. The active-plan i18n keys
 * (`chat.homeActions.whatsOnWeek*`) are intentionally kept in the locale
 * files so we avoid translation churn when the active-plan branch is
 * reintroduced.
 *
 * Card kinds:
 *   - navigate      -> jump to another screen (e.g. Week tab)
 *   - send_message  -> pre-fill + send a message to Irmixy
 *   - focus_input   -> focus the chat input (optionally pre-filling placeholder text)
 *
 * Planner routes aren't live yet; the navigate target points to the future
 * Week tab path so this component is ready when the route lands.
 */

import React from 'react';
import { View, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/common/Text';
import i18n from '@/i18n';
import { COLORS } from '@/constants/design-tokens';

type ActionKind =
    | { kind: 'navigate'; route: string }
    | { kind: 'send_message'; message: string }
    | { kind: 'focus_input'; placeholder?: string };

interface HomeActionCard {
    id: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    action: ActionKind;
}

export interface IrmixyHomeActionsProps {
    onSendMessage: (message: string) => void;
    onFocusInput: (placeholder?: string) => void;
}

/** Future Week tab route — kept in one place so updating is trivial when the tab lands. */
const WEEK_ROUTE = '/(tabs)/week';

function useHomeActionCards(): HomeActionCard[] {
    const t = (key: string) => i18n.t(key);

    // Only the no-plan set ships for now. See file header for rationale.
    return [
        {
            id: 'start_week',
            icon: 'calendar-week',
            label: t('chat.homeActions.startWeek'),
            action: { kind: 'navigate', route: WEEK_ROUTE },
        },
        {
            id: 'what_to_cook',
            icon: 'silverware-fork-knife',
            label: t('chat.homeActions.whatToCook'),
            action: {
                kind: 'send_message',
                message: t('chat.homeActions.whatToCookMessage'),
            },
        },
        {
            id: 'use_ingredients',
            icon: 'fridge-outline',
            label: t('chat.homeActions.useIngredients'),
            action: {
                kind: 'focus_input',
                placeholder: t('chat.homeActions.useIngredientsPlaceholder'),
            },
        },
    ];
}

export function IrmixyHomeActions({
    onSendMessage,
    onFocusInput,
}: IrmixyHomeActionsProps) {
    const cards = useHomeActionCards();

    const handlePress = (action: ActionKind) => {
        switch (action.kind) {
            case 'navigate':
                // Planner route may not exist yet; `router.push` is a no-op if
                // the route isn't registered, which is acceptable for this PR.
                router.push(action.route as never);
                return;
            case 'send_message':
                onSendMessage(action.message);
                return;
            case 'focus_input':
                onFocusInput(action.placeholder);
                return;
        }
    };

    return (
        <View className="w-full px-md gap-sm">
            {cards.map((card) => (
                <TouchableOpacity
                    key={card.id}
                    onPress={() => handlePress(card.action)}
                    activeOpacity={0.8}
                    className="flex-row items-center bg-primary-lightest rounded-lg px-md py-sm"
                >
                    <MaterialCommunityIcons
                        name={card.icon}
                        size={22}
                        color={COLORS.primary.darkest}
                    />
                    <Text className="ml-sm text-text-default flex-1">{card.label}</Text>
                    <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={COLORS.text.secondary}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
}
