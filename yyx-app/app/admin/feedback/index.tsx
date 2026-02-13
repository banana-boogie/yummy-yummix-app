import React, { useState } from 'react';
import { View, ActivityIndicator, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, Button } from '@/components/common';
import { AdminHeader } from '../_layout';
import { adminFeedbackService, FeedbackFilters } from '@/services/admin/adminFeedbackService';
import { AdminFeedbackItem } from '@/types/rating.types';
import { COLORS } from '@/constants/design-tokens';
import { PageLayout } from '@/components/layouts/PageLayout';
import { useLanguage } from '@/contexts/LanguageContext';
import i18n from '@/i18n';

export default function AdminFeedbackPage() {
    const { language } = useLanguage();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FeedbackFilters>({});

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin', 'feedback', filters, page, language],
        queryFn: () => adminFeedbackService.getFeedback({ ...filters, language }, page, 20),
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString(language === 'es' ? 'es-MX' : 'en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const renderFeedbackItem = ({ item }: { item: AdminFeedbackItem }) => (
        <View className="bg-white rounded-md p-md mb-sm shadow-sm">
            <View className="flex-row justify-between mb-xs">
                <Text preset="bodySmall" className="text-text-secondary flex-1">
                    {item.recipeName}
                </Text>
                <Text preset="caption" className="text-text-secondary">
                    {formatDate(item.createdAt)}
                </Text>
            </View>
            <Text preset="body" className="mb-sm">
                {item.feedback}
            </Text>
            <Text preset="caption" className="text-text-secondary">
                {i18n.t('admin.feedback.from', { email: item.userEmail })}
            </Text>
        </View>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <ActivityIndicator size="large" color={COLORS.primary.DEFAULT} />
                    <Text preset="body" className="mt-md text-text-secondary">
                        {i18n.t('admin.feedback.loading')}
                    </Text>
                </View>
            );
        }

        if (isError) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <Text preset="body" className="text-status-error mb-md">
                        {i18n.t('admin.feedback.error')}
                    </Text>
                    <Button
                        label={i18n.t('admin.feedback.retry')}
                        onPress={() => refetch()}
                        variant="primary"
                    />
                </View>
            );
        }

        if (!data?.data.length) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <Text preset="h2" className="text-text-secondary mb-sm">
                        {i18n.t('admin.feedback.noFeedbackTitle')}
                    </Text>
                    <Text preset="body" className="text-text-secondary text-center">
                        {i18n.t('admin.feedback.noFeedbackDescription')}
                    </Text>
                </View>
            );
        }

        return (
            <FlatList
                data={data.data}
                renderItem={renderFeedbackItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16 }}
                ListFooterComponent={() => (
                    <View className="flex-row justify-center gap-md py-md">
                        {page > 1 && (
                            <Button
                                label={i18n.t('admin.feedback.previous')}
                                onPress={() => setPage(p => p - 1)}
                                variant="outline"
                                size="small"
                            />
                        )}
                        {data.hasMore && (
                            <Button
                                label={i18n.t('admin.feedback.next')}
                                onPress={() => setPage(p => p + 1)}
                                variant="outline"
                                size="small"
                            />
                        )}
                    </View>
                )}
            />
        );
    };

    return (
        <View className="flex-1 bg-background-secondary">
            <AdminHeader title={i18n.t('admin.feedback.title')} showBackButton />
            <View className="px-md py-sm bg-white border-b border-border-default">
                <Text preset="caption" className="text-text-secondary">
                    {i18n.t('admin.feedback.entriesCount', { count: data?.count ?? 0 })}
                </Text>
            </View>
            {renderContent()}
        </View>
    );
}
