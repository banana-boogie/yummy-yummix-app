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
            // 1. Check if authenticated
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            // 2. Initialize provider (this will handle quota check and connection)



            // 2. Initialize provider
            if (!providerRef.current) {
                providerRef.current = VoiceProviderFactory.create('openai-realtime');

                // Set up event listeners
                providerRef.current.on('statusChange', setStatus);
                providerRef.current.on('transcript', setTranscript);
                providerRef.current.on('response', (res: any) => setResponse(res.text || ''));
                providerRef.current.on('error', (err: any) => setError(err.message));

                const initData = await providerRef.current.initialize({
                    language: language?.startsWith('es') ? 'es' : 'en'
                });

                if (initData) {
                    const quota: QuotaInfo = {
                        remainingMinutes: parseFloat(initData.remainingMinutes),
                        minutesUsed: parseFloat(initData.minutesUsed),
                        quotaLimit: initData.quotaLimit,
                        warning: initData.warning
                    };
                    setQuotaInfo(quota);

                    if (quota.warning && options?.onQuotaWarning) {
                        options.onQuotaWarning(quota);
                    }
                }
            }

            // 3. Build context
            const userContext = {
                language: (language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en',
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

    // Session Timeout Logic
    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        if (status === 'listening' || status === 'speaking' || status === 'processing') {
            const minutesLeft = quotaInfo?.remainingMinutes || 0;
            // Buffer: 30 seconds extra (grace period)
            const maxDurationSeconds = (minutesLeft * 60) + 30;
            const maxDurationMs = maxDurationSeconds * 1000;

            console.log(`[VoiceChat] Session will auto-end in ${maxDurationSeconds.toFixed(0)}s`);

            timeoutId = setTimeout(() => {
                console.log('[VoiceChat] Max duration reached. Stopping conversation.');
                stopConversation();
                alert('Session ended: You have reached your monthly voice quota.');
            }, maxDurationMs);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [status, quotaInfo, stopConversation]);

    const stopConversation = useCallback(() => {
        providerRef.current?.stopConversation();
    }, []);

    const updateContext = useCallback((recipeContext: RecipeContext) => {
        if (!providerRef.current) return;

        const userContext = {
            language: (language?.startsWith('es') ? 'es' : 'en') as 'es' | 'en',
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
