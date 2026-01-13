import React, { useState } from 'react';
import { View, ScrollView, ActivityIndicator, FlatList } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Text, Button } from '@/components/common';
import { AdminHeader } from '../_layout';
import { adminFeedbackService, FeedbackFilters } from '@/services/admin/adminFeedbackService';
import { AdminFeedbackItem } from '@/types/rating.types';
import { COLORS } from '@/constants/design-tokens';
import { PageLayout } from '@/components/layouts/PageLayout';

export default function AdminFeedbackPage() {
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<FeedbackFilters>({});

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['admin', 'feedback', filters, page],
        queryFn: () => adminFeedbackService.getFeedback(filters, page, 20),
    });

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
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
                From: {item.userEmail}
            </Text>
        </View>
    );

    const renderContent = () => {
        if (isLoading) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <ActivityIndicator size="large" color={COLORS.primary.DEFAULT} />
                    <Text preset="body" className="mt-md text-text-secondary">Loading feedback...</Text>
                </View>
            );
        }

        if (isError) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <Text preset="body" className="text-status-error mb-md">
                        Failed to load feedback
                    </Text>
                    <Button label="Retry" onPress={() => refetch()} variant="primary" />
                </View>
            );
        }

        if (!data?.data.length) {
            return (
                <View className="flex-1 justify-center items-center py-xl">
                    <Text preset="h2" className="text-text-secondary mb-sm">No Feedback Yet</Text>
                    <Text preset="body" className="text-text-secondary text-center">
                        User feedback will appear here after{'\n'}users rate and review recipes.
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
                                label="Previous"
                                onPress={() => setPage(p => p - 1)}
                                variant="outline"
                                size="small"
                            />
                        )}
                        {data.hasMore && (
                            <Button
                                label="Next"
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
            <AdminHeader title="User Feedback" showBackButton />
            <View className="px-md py-sm bg-white border-b border-border-default">
                <Text preset="caption" className="text-text-secondary">
                    {data?.count ?? 0} feedback entries
                </Text>
            </View>
            {renderContent()}
        </View>
    );
}
