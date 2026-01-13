import React, { useState, useRef } from 'react';
import { View, ScrollView, Modal, TextInput, TouchableOpacity, Keyboard, Platform } from 'react-native';
import { Stack, router } from 'expo-router';
import { Checkbox } from 'react-native-paper';

import i18n from '@/i18n';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';
import { DangerButton } from '@/components/common/DangerButton';
import { HeaderWithBack } from '@/components/common/HeaderWithBack';
import { PageLayout } from '@/components/layouts/PageLayout';
import { supabase } from '@/lib/supabase';

type DeleteReason = 'noUse' | 'technical' | 'foundBetter' | 'other';

// Confirmation modal component
const ConfirmationModal = ({
    visible,
    onClose,
    onConfirm,
    isDeleting
}: {
    visible: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isDeleting: boolean;
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center">
                <View className="bg-background-default rounded-lg p-md w-[90%] max-w-[400px]">
                    <Text preset="h1" className="text-center mb-sm">
                        {i18n.t('profile.deleteAccountFlow.feedback.finalConfirmation.title')}
                    </Text>

                    <Text className="text-center mb-md">
                        {i18n.t('profile.deleteAccountFlow.feedback.finalConfirmation.message')}
                    </Text>

                    <View className="gap-sm">
                        <Button
                            variant="primary"
                            size="large"
                            label={i18n.t('profile.deleteAccountFlow.feedback.finalConfirmation.cancel')}
                            onPress={onClose}
                            className="w-full"
                        />

                        <DangerButton
                            label={i18n.t('profile.deleteAccountFlow.feedback.finalConfirmation.confirm')}
                            onPress={onConfirm}
                            disabled={isDeleting}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

// Request received modal component
const RequestReceivedModal = ({
    visible,
    onClose
}: {
    visible: boolean;
    onClose: () => void;
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center">
                <View className="bg-background-default rounded-lg p-md w-[90%] max-w-[400px]">
                    <Text preset="h1" className="text-center mb-sm">
                        {i18n.t('profile.deleteAccountFlow.feedback.requestReceived.title')}
                    </Text>

                    <Text className="text-center mb-md">
                        {i18n.t('profile.deleteAccountFlow.feedback.requestReceived.message')}
                    </Text>

                    <Text className="text-text-default font-semibold text-lg text-center mb-xl">
                        support@yummyyummix.com
                    </Text>

                    <Button
                        variant="primary"
                        size="large"
                        label={i18n.t('profile.deleteAccountFlow.feedback.requestReceived.ok')}
                        onPress={onClose}
                        className="w-full"
                    />
                </View>
            </View>
        </Modal>
    );
};

// Error modal component
const ErrorModal = ({
    visible,
    onClose
}: {
    visible: boolean;
    onClose: () => void;
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={onClose}
        >
            <View className="flex-1 bg-black/50 justify-center items-center">
                <View className="bg-background-default rounded-lg p-md w-[90%] max-w-[400px]">
                    <Text preset="h1" className="text-center mb-sm text-status-error">
                        {i18n.t('common.errors.title')}
                    </Text>

                    <Text className="text-center text-text-SECONDARY mb-xs text-base">
                        {i18n.t('common.errors.default')}
                    </Text>
                    <Text className="text-center text-text-SECONDARY mb-xs text-base">
                        {i18n.t('common.errors.emailUs')}
                    </Text>
                    <Text className="text-text-default font-semibold text-lg text-center mb-xl">
                        support@yummyyummix.com
                    </Text>

                    <Button
                        variant="primary"
                        size="large"
                        label="OK"
                        onPress={onClose}
                        className="w-full"
                    />
                </View>
            </View>
        </Modal>
    );
};

export default function DeleteAccountFeedback() {
    const [reasons, setReasons] = useState<DeleteReason[]>([]);
    const [feedback, setFeedback] = useState('');
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [showRequestReceivedModal, setShowRequestReceivedModal] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);

    const handleToggleReason = (reason: DeleteReason) => {
        setReasons(prev =>
            prev.includes(reason)
                ? prev.filter(r => r !== reason)
                : [...prev, reason]
        );
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            // 1. Get current session for user info
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError) throw sessionError;
            if (!session) throw new Error('No active session');

            // 2. Send feedback and deletion request
            const { error: emailError } = await supabase.functions.invoke('send-delete-account-feedback', {
                body: {
                    reasons,
                    feedback,
                    userId: session.user.id,
                    userEmail: session.user.email,
                },
            });

            if (emailError) {
                throw emailError;
            }

            // 3. Show confirmation and navigate back
            setShowConfirmation(false);
            setShowRequestReceivedModal(true);
        } catch (error) {
            console.error('Error processing deletion request:', error);
            setShowConfirmation(false);
            setShowErrorModal(true);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleFeedbackFocus = () => {
        // Scroll to the bottom when keyboard appears
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleCloseRequestReceivedModal = () => {
        setShowRequestReceivedModal(false);
        router.back();
    };

    const content = (
        <ScrollView
            ref={scrollViewRef}
            className="flex-1"
            contentContainerStyle={{ padding: 16 }}
            keyboardShouldPersistTaps="handled"
        >
            <Text className="text-center mb-xl text-text-default">
                {i18n.t('profile.deleteAccountFlow.feedback.subtitle')}
            </Text>

            <Text className="mb-sm font-medium text-text-default">
                {i18n.t('profile.deleteAccountFlow.feedback.selectReason')}
            </Text>

            <View className="mb-md">
                {Object.entries(i18n.t('profile.deleteAccountFlow.feedback.reasons')).map(([key, label]) => (
                    <TouchableOpacity
                        key={key}
                        className="flex-row items-center my-xs py-xs pr-sm bg-background-SECONDARY rounded-sm"
                        onPress={() => handleToggleReason(key as DeleteReason)}
                        activeOpacity={0.7}
                    >
                        <View className="rounded-sm overflow-hidden">
                            <Checkbox.Android
                                status={reasons.includes(key as DeleteReason) ? 'checked' : 'unchecked'}
                                onPress={() => handleToggleReason(key as DeleteReason)}
                                color="#ff4b4b" // Using primary color or specific red for dangerous action
                                uncheckedColor="#999999"
                            />
                        </View>
                        <Text className="ml-xs text-text-default flex-1 text-base">
                            {label as string}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TextInput
                className="border border-border-default rounded-sm p-sm h-[120px] mb-xl text-text-default"
                placeholder={i18n.t('profile.deleteAccountFlow.feedback.tellUsMore')}
                value={feedback}
                onChangeText={setFeedback}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                placeholderTextColor="#999999"
                onFocus={handleFeedbackFocus}
            />

            <View className="mt-md pb-md">
                <Button
                    variant="primary"
                    size="large"
                    label={i18n.t('profile.deleteAccountFlow.cancel')}
                    onPress={() => {
                        Keyboard.dismiss();
                        router.back();
                    }}
                    className="my-md"
                />

                <DangerButton
                    label={i18n.t('profile.deleteAccountFlow.delete')}
                    onPress={() => {
                        Keyboard.dismiss();
                        setShowConfirmation(true);
                    }}
                    className="mt-auto"
                    disabled={reasons.length === 0}
                />
            </View>
        </ScrollView>
    );

    return (
        <PageLayout
            header={<HeaderWithBack title={i18n.t('profile.deleteAccountFlow.feedback.title')} />}
            backgroundColor="#ffffff"
            adjustForTabBar={false}
        >
            <Stack.Screen options={{ headerShown: false }} />

            {content}

            <ConfirmationModal
                visible={showConfirmation}
                onClose={() => setShowConfirmation(false)}
                onConfirm={handleDelete}
                isDeleting={isDeleting}
            />

            <RequestReceivedModal
                visible={showRequestReceivedModal}
                onClose={handleCloseRequestReceivedModal}
            />

            <ErrorModal
                visible={showErrorModal}
                onClose={() => setShowErrorModal(false)}
            />
        </PageLayout>
    );
}
