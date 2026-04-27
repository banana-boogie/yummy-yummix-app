// Network status stub — assumes always online. Offline sync is disabled in the
// current port; a real implementation should use @react-native-community/netinfo.
interface NetworkStatus {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}

export function useNetworkStatus(): NetworkStatus {
  return { isConnected: true, isInternetReachable: true, type: null };
}

export default useNetworkStatus;
