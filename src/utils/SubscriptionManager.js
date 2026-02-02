import { Alert, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// 1. YOUR API KEYS
const API_KEYS = {
  apple: "appl_BpVXspbmCpzCXliDeOJlsGwbGIx",  // Your Real Key
  google: "goog_YOUR_REVENUECAT_KEY_HERE"     // Placeholder for Android
};

// 2. YOUR ENTITLEMENT ID (Must match RevenueCat exactly)
const ENTITLEMENT_ID = 'pro'; 

class SubscriptionManager {
  
  // Start the System
  static async configure() {
    try {
      if (Platform.OS === 'ios') {
        await Purchases.configure({ apiKey: API_KEYS.apple });
      } else {
        await Purchases.configure({ apiKey: API_KEYS.google });
      }
      console.log("💳 RevenueCat Configured");
    } catch (e) {
      console.log("Error configuring purchases:", e);
    }
  }

  // Check if they are already premium (runs on App Start)
  static async getCustomerInfo() {
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      // Check if they have an active entitlement called "pro"
      const isActive = customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
      return isActive;
    } catch (e) {
      return false;
    }
  }

  // Get the Offerings to display
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

  // The "Buy Now" Action
  static async purchase(packageToBuy) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      
      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        console.log("✅ Purchase Successful! Entitlement Active.");
        return true; 
      } else {
        console.log("⚠️ Purchase complete, but entitlement missing. Check RevenueCat Product Linking.");
        return false;
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Purchase Error", e.message);
      }
      return false;
    }
  }

  // The "Restore Purchases" Action
  static async restore() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      
      // --- DEBUGGING LOG ---
      console.log("🔍 RESTORE DEBUG:", JSON.stringify(customerInfo.entitlements.active, null, 2));

      if (customerInfo.entitlements.active[ENTITLEMENT_ID]) {
        return true;
      } else {
        // If logs show empty {}, it means the user bought the product, 
        // but the Product is NOT linked to the Entitlement in RevenueCat.
        return false;
      }
    } catch (e) {
      Alert.alert("Restore Error", e.message);
      return false;
    }
  }
}

export default SubscriptionManager;