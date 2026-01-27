import { useState, useEffect } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
    isConnected: boolean;
    isInternetReachable: boolean | null;
    type: string | null;
}

/**
 * Hook for monitoring network connectivity status.
 * Subscribes to network state changes and provides current connectivity status.
 *
 * @example
 * const { isConnected, isInternetReachable } = useNetworkStatus();
 *
 * if (!isConnected) {
 *   // Show offline UI
 * }
 */
export function useNetworkStatus(): NetworkStatus {
    const [networkStatus, setNetworkStatus] = useState<NetworkStatus>({
        isConnected: true,
        isInternetReachable: true,
        type: null,
    });

    useEffect(() => {
        // Get initial state
        NetInfo.fetch().then((state: NetInfoState) => {
            setNetworkStatus({
                isConnected: state.isConnected ?? true,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
            });
        });

        // Subscribe to changes
        const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
            setNetworkStatus({
                isConnected: state.isConnected ?? true,
                isInternetReachable: state.isInternetReachable,
                type: state.type,
            });
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return networkStatus;
}

export default useNetworkStatus;
