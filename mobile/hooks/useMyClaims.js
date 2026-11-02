import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { getApiError } from '../services/api';
import { getMyClaims } from '../services/claimService';

const REFRESH_INTERVAL_MS = 30000;

export function useMyClaims() {
  const [claims, setClaims] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setClaims(await getMyClaims());
      setError('');
    } catch (loadError) {
      setError(getApiError(loadError));
      setClaims(current => current ?? { sent: [], received: [] });
    }
  }, []);

  useFocusEffect(useCallback(() => {
    load();
    const timer = setInterval(load, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [load]));

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return { claims, error, refreshing, refresh };
}
