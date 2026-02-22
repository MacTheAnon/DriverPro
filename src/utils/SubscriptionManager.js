import { Alert, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// 1. YOUR API KEYS
const API_KEYS = {
  apple: "appl_BpVXspbmCpzCXliDeOJlsGwbGIx", 
  google: "goog_YOUR_REVENUECAT_KEY_HERE"
};

const ENTITLEMENT_ID = 'pro'; 

class SubscriptionManager {
  
  static async configure() {
    try {
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: API_KEYS.apple });
      } else {
        // FIX: fail loudly if Android key is still a placeholder instead of silently misconfiguring
        if (API_KEYS.google.includes('YOUR_REVENUECAT_KEY_HERE')) {
          console.error("❌ SubscriptionManager: Android RevenueCat API key is not set. Replace 'goog_YOUR_REVENUECAT_KEY_HERE' in SubscriptionManager.js with your real key from the RevenueCat dashboard.");
          return;
        }
        await Purchases.configure({ apiKey: API_KEYS.google });
      }
      console.log("💳 RevenueCat Configured");
    } catch (e) {
      console.log("Error configuring purchases:", e);
    }
  }

  static async getCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      // DEBUG: Log what entitlements the user actually has
      console.log("🔍 Checking Entitlements:", Object.keys(customerInfo.entitlements.active));
      
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      return false;
    }
  }

  static async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        return offerings.current.availablePackages; 
      }
      return [];
    } catch (e) {
      console.log("Error fetching offerings:", e);
      return [];
    }
  }

  static async purchase(packageToBuy) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      
      // DEBUG LOGS - READ THESE IN YOUR TERMINAL
      console.log("💰 Purchase Complete. Checking Entitlements...");
      console.log("📜 Active Entitlements:", JSON.stringify(customerInfo.entitlements.active, null, 2));

      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        console.log("✅ verified: 'pro' is active.");
        return true; 
      } else {
        console.log("❌ FAILURE: Product purchased, but 'pro' entitlement is missing.");
        Alert.alert(
          "Setup Error", 
          "Payment successful, but RevenueCat didn't unlock the feature. \n\nGo to RevenueCat Dashboard -> Products -> Select your product -> Click 'Entitlements' in sidebar -> Attach 'pro'."
        );
        return false;
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Purchase Error", e.message);
      }
      return false;
    }
  }

  static async restore() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      console.log("♻️ Restore found:", Object.keys(customerInfo.entitlements.active));
      return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
    } catch (e) {
      Alert.alert("Restore Error", e.message);
      return false;
    }
  }
}

export default SubscriptionManager;