import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import SubscriptionManager from '../utils/SubscriptionManager';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- NEW: Helper Function to Force Refresh ---
  const refreshPremiumStatus = async () => {
    /* */
    // We use the existing manager to fetch fresh data
    const status = await SubscriptionManager.getCustomerInfo();
    console.log("🔄 Context Refreshing Premium Status:", status);
    setIsPremium(status);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // Initialize and check once on load
        await SubscriptionManager.configure();
        await refreshPremiumStatus();
      } else {
        setIsPremium(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    // EXPOSE 'refreshPremiumStatus' TO THE APP so PremiumScreen can use it
    <UserContext.Provider value={{ user, isPremium, loading, refreshPremiumStatus }}>
      {children}
    </UserContext.Provider>
  );
};