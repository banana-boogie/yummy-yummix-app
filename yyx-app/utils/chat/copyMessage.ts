import { Platform, Alert } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import i18n from '@/i18n';

/**
 * Copy a message to the clipboard with haptic feedback and a confirmation alert.
 * Shared between text chat (useChatMessageActions) and voice chat (VoiceChatScreen).
 */
export async function copyMessageToClipboard(content: string): Promise<void> {
    await Clipboard.setStringAsync(content);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS === 'ios') {
        Alert.alert(
            i18n.t('common.copied'),
            i18n.t('chat.messageCopied'),
            [{ text: i18n.t('common.ok') }],
            { userInterfaceStyle: 'unspecified' },
        );
    } else {
        Alert.alert(i18n.t('common.copied'), i18n.t('chat.messageCopied'));
    }
}
