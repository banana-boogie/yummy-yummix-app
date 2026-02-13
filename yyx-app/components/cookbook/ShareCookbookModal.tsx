import React, { useEffect, useState } from 'react';
import { View, Modal, Pressable, Share, Platform, Switch, Alert } from 'react-native';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Cookbook } from '@/types/cookbook.types';
import { useRegenerateShareToken, useUpdateCookbook } from '@/hooks/useCookbookQuery';
import { COLORS } from '@/constants/design-tokens';
import i18n from '@/i18n';
import { getAppBaseUrl } from '@/utils/urls';

interface ShareCookbookModalProps {
    visible: boolean;
    onClose: () => void;
    cookbook: Cookbook;
}

export function ShareCookbookModal({
    visible,
    onClose,
    cookbook,
}: ShareCookbookModalProps) {
    const regenerateTokenMutation = useRegenerateShareToken();
    const updateCookbookMutation = useUpdateCookbook();
    const [copied, setCopied] = useState(false);
    const [shareEnabled, setShareEnabled] = useState(cookbook.shareEnabled);
    const [shareToken, setShareToken] = useState(cookbook.shareToken);

    useEffect(() => {
        setShareEnabled(cookbook.shareEnabled);
        setShareToken(cookbook.shareToken);
        setCopied(false);
    }, [cookbook]);

    // Generate the shareable URL
    const shareUrl = shareEnabled
        ? `${getAppBaseUrl()}/shared/cookbook/${shareToken}`
        : '';

    const handleCopyLink = async () => {
        if (!shareEnabled || !shareUrl) return;
        await Clipboard.setStringAsync(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
            if (!shareEnabled || !shareUrl) return;
            await Share.share({
                message: Platform.OS === 'ios'
                    ? cookbook.name
                    : `${cookbook.name}: ${shareUrl}`,
                url: Platform.OS === 'ios' ? shareUrl : undefined,
                title: cookbook.name,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    const handleRegenerateLink = async () => {
        try {
            const newToken = await regenerateTokenMutation.mutateAsync(cookbook.id);
            setShareToken(newToken);
            setShareEnabled(true);
        } catch (error) {
            console.error('Error regenerating link:', error);
            Alert.alert(i18n.t('common.errors.title'), i18n.t('common.errors.default'));
        }
    };

    const handleToggleSharing = async (value: boolean) => {
        try {
            if (value) {
                await handleRegenerateLink();
                return;
            }
            await updateCookbookMutation.mutateAsync({
                cookbookId: cookbook.id,
                input: { shareEnabled: false },
            });
            setShareEnabled(false);
            setCopied(false);
        } catch (error) {
            console.error('Error updating sharing setting:', error);
            Alert.alert(i18n.t('common.errors.title'), i18n.t('common.errors.default'));
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center p-lg">
                <View className="bg-primary-lightest rounded-xl p-lg w-full max-w-md">
                    {/* Header */}
                    <View className="flex-row items-center justify-between mb-lg">
                        <Text preset="h2">{i18n.t('cookbooks.shareCookbook')}</Text>
                        <Pressable
                            onPress={onClose}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('cookbooks.a11y.closeModal')}
                            className="p-xs"
                        >
                            <Ionicons name="close" size={24} color={COLORS.text.default} />
                        </Pressable>
                    </View>

                    {/* Cookbook info */}
                    <View className="bg-white/60 rounded-md p-md mb-lg">
                        <Text preset="subheading">{cookbook.name}</Text>
                        {cookbook.description && (
                            <Text preset="caption" className="text-text-secondary mt-xs">
                                {cookbook.description}
                            </Text>
                        )}
                        <View className="flex-row items-center mt-sm">
                            <Ionicons
                                name={cookbook.isPublic ? "globe-outline" : "lock-closed-outline"}
                                size={14}
                                color={COLORS.text.secondary}
                            />
                            <Text preset="caption" className="text-text-secondary ml-xs">
                                {cookbook.isPublic
                                    ? i18n.t('cookbooks.publicLabel')
                                    : i18n.t('cookbooks.privateLabel')}
                            </Text>
                        </View>
                    </View>

                    {/* Share info */}
                    <View className="mb-md">
                        <Text preset="body" className="text-text-secondary mb-sm">
                            {cookbook.isPublic
                                ? i18n.t('cookbooks.sharePublicInfo')
                                : i18n.t('cookbooks.sharePrivateInfo')}
                        </Text>
                    </View>

                    {/* Share enabled toggle */}
                    <View className="flex-row items-center justify-between mb-md bg-white p-md rounded-md border border-neutral-200">
                        <View className="flex-1 mr-md">
                            <Text preset="subheading">{i18n.t('cookbooks.shareEnabled')}</Text>
                            <Text preset="caption" className="text-text-secondary">
                                {i18n.t('cookbooks.shareEnabledDescription')}
                            </Text>
                        </View>
                        <Switch
                            value={shareEnabled}
                            onValueChange={handleToggleSharing}
                            disabled={regenerateTokenMutation.isPending || updateCookbookMutation.isPending}
                            trackColor={{ false: COLORS.grey.medium, true: COLORS.status.success }}
                        />
                    </View>

                    {!shareEnabled && (
                        <Text preset="caption" className="text-text-secondary mb-md">
                            {i18n.t('cookbooks.shareDisabledInfo')}
                        </Text>
                    )}

                    {/* Share link */}
                    <View className="bg-white rounded-md p-md mb-md flex-row items-center border border-neutral-200">
                        <Text
                            preset="caption"
                            className="flex-1 text-text-secondary"
                            numberOfLines={1}
                            accessibilityLabel={shareUrl || i18n.t('cookbooks.shareDisabledPlaceholder')}
                        >
                            {shareUrl || i18n.t('cookbooks.shareDisabledPlaceholder')}
                        </Text>
                        <Pressable
                            onPress={handleCopyLink}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('cookbooks.a11y.copyLink')}
                            className="ml-sm p-xs"
                            disabled={!shareEnabled}
                        >
                            <Ionicons
                                name={copied ? 'checkmark' : 'copy-outline'}
                                size={20}
                                color={copied ? COLORS.status.success : COLORS.text.secondary}
                            />
                        </Pressable>
                    </View>

                    {/* Actions */}
                    <View className="gap-sm">
                        <Button
                            variant="primary"
                            onPress={handleShare}
                            disabled={!shareEnabled}
                            icon={<Ionicons name="share-outline" size={18} color={COLORS.text.default} />}
                        >
                            {i18n.t('cookbooks.shareLink')}
                        </Button>

                        <Button
                            variant="outline"
                            onPress={handleRegenerateLink}
                            disabled={
                                regenerateTokenMutation.isPending ||
                                updateCookbookMutation.isPending ||
                                !shareEnabled
                            }
                        >
                            {regenerateTokenMutation.isPending
                                ? i18n.t('common.loading')
                                : i18n.t('cookbooks.regenerateLink')}
                        </Button>

                        {shareEnabled && (
                            <Text preset="caption" className="text-text-secondary text-center">
                                {i18n.t('cookbooks.regenerateLinkInfo')}
                            </Text>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
