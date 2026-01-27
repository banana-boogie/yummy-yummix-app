import React, { useState, useEffect, useCallback } from 'react';
import { View, Modal, Switch } from 'react-native';
import { Text, Button, TextInput } from '@/components/common';
import { Cookbook, CreateCookbookInput, UpdateCookbookInput } from '@/types/cookbook.types';
import i18n from '@/i18n';
import { Ionicons } from '@expo/vector-icons';

const NAME_MIN_LENGTH = 3;
const NAME_MAX_LENGTH = 50;
const DESCRIPTION_MAX_LENGTH = 300;

interface CreateEditCookbookModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (input: CreateCookbookInput | UpdateCookbookInput) => void;
    cookbook?: Cookbook; // If provided, we're editing
    isLoading?: boolean;
}

export function CreateEditCookbookModal({
    visible,
    onClose,
    onSave,
    cookbook,
    isLoading = false,
}: CreateEditCookbookModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [nameError, setNameError] = useState('');
    const [descriptionError, setDescriptionError] = useState('');
    const [touched, setTouched] = useState({ name: false, description: false });

    useEffect(() => {
        if (visible) {
            if (cookbook) {
                setName(cookbook.name);
                setDescription(cookbook.description || '');
                setIsPublic(cookbook.isPublic);
            } else {
                setName('');
                setDescription('');
                setIsPublic(false);
            }
            setNameError('');
            setDescriptionError('');
            setTouched({ name: false, description: false });
        }
    }, [visible, cookbook]);

    const validateName = useCallback((value: string): string => {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return i18n.t('cookbooks.validation.nameRequired');
        }
        if (trimmed.length < NAME_MIN_LENGTH) {
            return i18n.t('cookbooks.validation.nameTooShort', { min: NAME_MIN_LENGTH });
        }
        if (trimmed.length > NAME_MAX_LENGTH) {
            return i18n.t('cookbooks.validation.nameTooLong', { max: NAME_MAX_LENGTH });
        }
        return '';
    }, []);

    const validateDescription = useCallback((value: string): string => {
        if (value.trim().length > DESCRIPTION_MAX_LENGTH) {
            return i18n.t('cookbooks.validation.descriptionTooLong', {
                max: DESCRIPTION_MAX_LENGTH,
            });
        }
        return '';
    }, []);

    const handleNameChange = (value: string) => {
        setName(value);
        if (touched.name) {
            setNameError(validateName(value));
        }
    };

    const handleDescriptionChange = (value: string) => {
        setDescription(value);
        if (touched.description) {
            setDescriptionError(validateDescription(value));
        }
    };

    const handleNameBlur = () => {
        setTouched((prev) => ({ ...prev, name: true }));
        setNameError(validateName(name));
    };

    const handleDescriptionBlur = () => {
        setTouched((prev) => ({ ...prev, description: true }));
        setDescriptionError(validateDescription(description));
    };

    const handleSave = () => {
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();

        // Validate before save
        const nameValidationError = validateName(trimmedName);
        const descValidationError = validateDescription(trimmedDescription);

        setTouched({ name: true, description: true });
        setNameError(nameValidationError);
        setDescriptionError(descValidationError);

        if (nameValidationError || descValidationError) {
            return;
        }

        const input: CreateCookbookInput | UpdateCookbookInput = {
            nameEn: trimmedName,
            descriptionEn: trimmedDescription || undefined,
            isPublic,
        };

        onSave(input);
    };

    const isValid = !validateName(name) && !validateDescription(description);

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-primary-lightest rounded-t-xl p-lg">
                    <View className="flex-row justify-between items-center mb-md">
                        <Text preset="h2">
                            {cookbook ? i18n.t('cookbooks.editCookbook') : i18n.t('cookbooks.createCookbook')}
                        </Text>
                        <Ionicons name="close" size={24} onPress={onClose} />
                    </View>

                    <View className="mb-md">
                        <View className="flex-row justify-between items-center mb-xs">
                            <Text preset="subheading">{i18n.t('cookbooks.name')}</Text>
                            <Text
                                preset="caption"
                                className={`${
                                    name.trim().length > NAME_MAX_LENGTH
                                        ? 'text-status-error'
                                        : 'text-text-secondary'
                                }`}
                            >
                                {name.trim().length}/{NAME_MAX_LENGTH}
                            </Text>
                        </View>
                        <TextInput
                            value={name}
                            onChangeText={handleNameChange}
                            onBlur={handleNameBlur}
                            placeholder={i18n.t('cookbooks.namePlaceholder')}
                            maxLength={NAME_MAX_LENGTH + 10} // Allow slight overflow for better UX
                            accessibilityLabel={i18n.t('cookbooks.name')}
                            className={`bg-white rounded-md p-md border ${
                                nameError && touched.name
                                    ? 'border-status-error'
                                    : 'border-neutral-200'
                            }`}
                        />
                        {nameError && touched.name && (
                            <Text preset="caption" className="text-status-error mt-xs">
                                {nameError}
                            </Text>
                        )}
                    </View>

                    <View className="mb-md">
                        <View className="flex-row justify-between items-center mb-xs">
                            <Text preset="subheading">{i18n.t('cookbooks.description')}</Text>
                            <Text
                                preset="caption"
                                className={`${
                                    description.trim().length > DESCRIPTION_MAX_LENGTH
                                        ? 'text-status-error'
                                        : 'text-text-secondary'
                                }`}
                            >
                                {description.trim().length}/{DESCRIPTION_MAX_LENGTH}
                            </Text>
                        </View>
                        <TextInput
                            value={description}
                            onChangeText={handleDescriptionChange}
                            onBlur={handleDescriptionBlur}
                            placeholder={i18n.t('cookbooks.descriptionPlaceholder')}
                            maxLength={DESCRIPTION_MAX_LENGTH + 20} // Allow slight overflow for better UX
                            accessibilityLabel={i18n.t('cookbooks.description')}
                            className={`bg-white rounded-md p-md border ${
                                descriptionError && touched.description
                                    ? 'border-status-error'
                                    : 'border-neutral-200'
                            }`}
                            multiline
                            numberOfLines={3}
                        />
                        {descriptionError && touched.description && (
                            <Text preset="caption" className="text-status-error mt-xs">
                                {descriptionError}
                            </Text>
                        )}
                    </View>

                    <View className="flex-row items-center justify-between mb-lg bg-white p-md rounded-md border border-neutral-200">
                        <View className="flex-1 mr-md">
                            <Text preset="subheading">{i18n.t('cookbooks.makePublic')}</Text>
                            <Text preset="caption" className="text-text-secondary">
                                {i18n.t('cookbooks.publicDescription')}
                            </Text>
                        </View>
                        <Switch
                            value={isPublic}
                            onValueChange={setIsPublic}
                            trackColor={{ false: '#ccc', true: '#78A97A' }} // Using a known green/brand color
                        />
                    </View>

                    <View className="flex-row gap-md">
                        <Button variant="secondary" onPress={onClose} className="flex-1">
                            {i18n.t('common.cancel')}
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleSave}
                            disabled={!isValid || isLoading}
                            className="flex-1"
                        >
                            {isLoading
                                ? i18n.t('common.saving')
                                : cookbook
                                  ? i18n.t('common.save')
                                  : i18n.t('cookbooks.create')}
                        </Button>
                    </View>

                    {/* Safety padding for bottom */}
                    <View className="h-8" />
                </View>
            </View>
        </Modal>
    );
}
