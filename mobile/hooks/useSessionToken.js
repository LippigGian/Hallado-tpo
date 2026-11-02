import { useEffect, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { SESSION_KEY } from '../services/api';

export function useSessionToken() {
  const [token, setToken] = useState(null);

  useEffect(() => {
    let active = true;
    SecureStore.getItemAsync(SESSION_KEY)
      .then(raw => { if (active) setToken(raw ? JSON.parse(raw).token : null); })
      .catch(() => { if (active) setToken(null); });
    return () => { active = false; };
  }, []);

  return token;
}
