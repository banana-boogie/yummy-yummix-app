import { useState, useCallback, useEffect, useRef } from 'react';
import { GeminiLiveService } from '../services/geminiLiveService';

export interface UseGeminiLiveReturn {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    connect: (systemInstruction?: string) => Promise<void>;
    disconnect: () => Promise<void>;
}

export function useGeminiLive(): UseGeminiLiveReturn {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    
    const serviceRef = useRef<GeminiLiveService | null>(null);

    useEffect(() => {
        serviceRef.current = new GeminiLiveService();
        return () => {
            serviceRef.current?.disconnect();
        };
    }, []);

    const connect = useCallback(async (systemInstruction?: string) => {
        if (!serviceRef.current) return;
        
        try {
            setIsConnecting(true);
            setError(null);
            await serviceRef.current.connect({ systemInstruction });
            setIsConnected(true);
        } catch (e: any) {
            setError(e.message || 'Failed to connect');
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (!serviceRef.current) return;
        await serviceRef.current.disconnect();
        setIsConnected(false);
    }, []);

    return {
        isConnected,
        isConnecting,
        error,
        connect,
        disconnect,
    };
}
