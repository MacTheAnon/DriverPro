import { onAuthStateChanged } from 'firebase/auth';
import { createContext, useEffect, useState } from 'react';
import { auth } from '../firebaseConfig';
import SubscriptionManager from '../utils/SubscriptionManager';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for Auth Changes
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // If logged in, check if they paid
        await SubscriptionManager.configure();
        const premiumStatus = await SubscriptionManager.getCustomerInfo();
        setIsPremium(premiumStatus);
      } else {
        setIsPremium(false);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ user, isPremium, loading }}>
      {children}
    </UserContext.Provider>
  );
};