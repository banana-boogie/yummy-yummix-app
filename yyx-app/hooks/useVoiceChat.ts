import { useState, useEffect, useCallback, useRef } from 'react';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { supabase } from '@/lib/supabase';
import { VoiceProviderFactory } from '@/services/voice/VoiceProviderFactory';
import type {
    VoiceAssistantProvider,
    VoiceStatus,
    RecipeContext,
    QuotaInfo
} from '@/services/voice/types';

interface UseVoiceChatOptions {
    recipeContext?: RecipeContext;
    onQuotaWarning?: (info: QuotaInfo) => void;
}

export function useVoiceChat(options?: UseVoiceChatOptions) {
    const [status, setStatus] = useState<VoiceStatus>('idle');
    const [transcript, setTranscript] = useState('');
    const [response, setResponse] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);

    const { userProfile } = useUserProfile();
    const { language } = useLanguage();
    const { measurementSystem } = useMeasurement();

    const providerRef = useRef<VoiceAssistantProvider | null>(null);

    useEffect(() => {
        // Cleanup on unmount
        return () => {
            providerRef.current?.destroy();
        };
    }, []);

    const startConversation = useCallback(async () => {
        setError(null);
        setTranscript('');
        setResponse('');

        try {
            // 1. Check quota and get session
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const quotaResponse = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_FUNCTIONS_URL}/start-voice-session`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (!quotaResponse.ok) {
                const errorData = await quotaResponse.json();
                throw new Error(errorData.error || 'Failed to start voice session');
            }

            const quotaData = await quotaResponse.json();

            const quota: QuotaInfo = {
                remainingMinutes: parseFloat(quotaData.remainingMinutes),
                minutesUsed: parseFloat(quotaData.minutesUsed),
                quotaLimit: quotaData.quotaLimit,
                warning: quotaData.warning
            };

            setQuotaInfo(quota);

            // Show warning if exists
            if (quota.warning && options?.onQuotaWarning) {
                options.onQuotaWarning(quota);
            }

            // 2. Initialize provider
            if (!providerRef.current) {
                providerRef.current = VoiceProviderFactory.create('openai-realtime');

                // Set up event listeners
                providerRef.current.on('statusChange', setStatus);
                providerRef.current.on('transcript', setTranscript);
                providerRef.current.on('response', (res: any) => setResponse(res.text || ''));
                providerRef.current.on('error', (err: any) => setError(err.message));

                await providerRef.current.initialize({
                    language: language?.startsWith('es') ? 'es' : 'en',
                    sessionId: quotaData.sessionId
                });
            }

            // 3. Build context
            const userContext = {
                language: language?.startsWith('es') ? 'es' : 'en',
                measurementSystem: measurementSystem || 'metric',
                dietaryRestrictions: userProfile?.dietaryRestrictions || [],
                dietTypes: userProfile?.dietTypes || []
            };

            // 4. Start conversation
            await providerRef.current.startConversation({
                userContext,
                recipeContext: options?.recipeContext
            });

        } catch (err) {
            console.error('[VoiceChat] Start error:', err);
            setError(err instanceof Error ? err.message : 'Unknown error');
        }
    }, [language, measurementSystem, userProfile, options]);

    const stopConversation = useCallback(() => {
        providerRef.current?.stopConversation();
    }, []);

    const updateContext = useCallback((recipeContext: RecipeContext) => {
        if (!providerRef.current) return;

        const userContext = {
            language: language?.startsWith('es') ? 'es' : 'en',
            measurementSystem: measurementSystem || 'metric',
            dietaryRestrictions: userProfile?.dietaryRestrictions || [],
            dietTypes: userProfile?.dietTypes || []
        };

        providerRef.current.setContext(userContext, recipeContext);
    }, [language, measurementSystem, userProfile]);

    return {
        status,
        transcript,
        response,
        error,
        quotaInfo,
        startConversation,
        stopConversation,
        updateContext
    };
}
