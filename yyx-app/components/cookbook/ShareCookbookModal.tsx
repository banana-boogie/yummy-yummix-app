import React, { useState } from 'react';
import { View, Modal, Pressable, Share, Platform } from 'react-native';
import { Text, Button } from '@/components/common';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { Cookbook } from '@/types/cookbook.types';
import { useRegenerateShareToken } from '@/hooks/useCookbookQuery';
import i18n from '@/i18n';

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
    const [copied, setCopied] = useState(false);

    // Generate the shareable URL
    const shareUrl = `https://yummyyummix.com/shared/cookbook/${cookbook.shareToken}`;

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = async () => {
        try {
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
            await regenerateTokenMutation.mutateAsync(cookbook.id);
        } catch (error) {
            console.error('Error regenerating link:', error);
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
                            <Ionicons name="close" size={24} color="#2D2D2D" />
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
                                color="#666"
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

                    {/* Share link */}
                    <View className="bg-white rounded-md p-md mb-md flex-row items-center border border-neutral-200">
                        <Text
                            preset="caption"
                            className="flex-1 text-text-secondary"
                            numberOfLines={1}
                            accessibilityLabel={shareUrl}
                        >
                            {shareUrl}
                        </Text>
                        <Pressable
                            onPress={handleCopyLink}
                            accessibilityRole="button"
                            accessibilityLabel={i18n.t('cookbooks.a11y.copyLink')}
                            className="ml-sm p-xs"
                        >
                            <Ionicons
                                name={copied ? 'checkmark' : 'copy-outline'}
                                size={20}
                                color={copied ? '#78A97A' : '#666'}
                            />
                        </Pressable>
                    </View>

                    {/* Actions */}
                    <View className="gap-sm">
                        <Button
                            variant="primary"
                            onPress={handleShare}
                            icon={<Ionicons name="share-outline" size={18} color="#2D2D2D" />}
                        >
                            {i18n.t('cookbooks.shareLink')}
                        </Button>

                        <Button
                            variant="outline"
                            onPress={handleRegenerateLink}
                            disabled={regenerateTokenMutation.isPending}
                        >
                            {regenerateTokenMutation.isPending
                                ? i18n.t('common.loading')
                                : i18n.t('cookbooks.regenerateLink')}
                        </Button>

                        <Text preset="caption" className="text-text-secondary text-center">
                            {i18n.t('cookbooks.regenerateLinkInfo')}
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}
