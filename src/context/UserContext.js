import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useCallback, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import SubscriptionManager from '../utils/SubscriptionManager';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  // FIX: Wrapped in useCallback so the function reference is stable across renders.
  // Without this, useEffect's closure captures the initial version and never sees
  // updated state if this function ever depends on it in the future.
  const refreshPremiumStatus = useCallback(async () => {
    const status = await SubscriptionManager.getCustomerInfo();
    console.log('🔄 Context Refreshing Premium Status:', status);
    setIsPremium(status);
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        await SubscriptionManager.configure();
        await refreshPremiumStatus();
      } else {
        setIsPremium(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [refreshPremiumStatus]);

  return (
    <UserContext.Provider value={{ user, isPremium, loading, refreshPremiumStatus }}>
      {children}
    </UserContext.Provider>
  );
};
