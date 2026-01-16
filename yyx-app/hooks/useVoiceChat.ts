/**
 * useVoiceChat Hook
 * 
 * Manages voice chat state and interactions with OpenAI Realtime provider.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useMeasurement } from '@/contexts/MeasurementContext';
import { VoiceProviderFactory } from '@/services/voice/VoiceProviderFactory';
import type {
    VoiceAssistantProvider,
    VoiceStatus,
    RecipeContext,
    QuotaInfo,
} from '@/services/voice/types';

interface UseVoiceChatOptions {
    recipeContext?: RecipeContext;
    onQuotaWarning?: (quota: QuotaInfo) => void;
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

            // 2. Create OpenAI Realtime provider instance
            providerRef.current = VoiceProviderFactory.create('openai-realtime');

            // Set up event listeners
            providerRef.current.on('statusChange', setStatus);
            providerRef.current.on('transcript', setTranscript);
            providerRef.current.on('response', (res: any) => {
                const text = res.text || res.transcript || '';
                setResponse(text);
            });
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
