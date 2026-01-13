import React, { useState, useEffect } from 'react';
import { View, Modal, Switch } from 'react-native';
import { Text, Button, TextInput } from '@/components/common';
import { Cookbook, CreateCookbookInput, UpdateCookbookInput } from '@/types/cookbook.types';
import i18n from '@/i18n';
import { Ionicons } from '@expo/vector-icons';

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
    isLoading = false
}: CreateEditCookbookModalProps) {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [isPublic, setIsPublic] = useState(false);

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
        }
    }, [visible, cookbook]);

    const handleSave = () => {
        if (!name.trim()) return;

        const input: any = {
            nameEn: name, // Simplified: assuming user writes in their current language
            descriptionEn: description,
            isPublic,
        };

        // In a real app we might ask language or detect it, 
        // for MVP we can save to both or just EN/ES based on locale.
        // For now, mapping to EN fields is safe as a default.

        onSave(input);
    };

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
                        <Text preset="subheading" className="mb-xs">{i18n.t('cookbooks.name')}</Text>
                        <TextInput
                            value={name}
                            onChangeText={setName}
                            placeholder={i18n.t('cookbooks.namePlaceholder')}
                            className="bg-white rounded-md p-md border border-neutral-200"
                        />
                    </View>

                    <View className="mb-md">
                        <Text preset="subheading" className="mb-xs">{i18n.t('cookbooks.description')}</Text>
                        <TextInput
                            value={description}
                            onChangeText={setDescription}
                            placeholder={i18n.t('cookbooks.descriptionPlaceholder')}
                            className="bg-white rounded-md p-md border border-neutral-200"
                            multiline
                            numberOfLines={3}
                        />
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
                            disabled={!name.trim() || isLoading}
                            className="flex-1"
                        >
                            {isLoading ? i18n.t('common.saving') : (cookbook ? i18n.t('common.save') : i18n.t('cookbooks.create'))}
                        </Button>
                    </View>

                    {/* Safety padding for bottom */}
                    <View className="h-8" />
                </View>
            </View>
        </Modal>
    );
}
