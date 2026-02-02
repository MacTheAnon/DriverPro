import { Alert, Platform } from 'react-native';
import Purchases from 'react-native-purchases';

// 1. Get these keys from the RevenueCat Dashboard
const API_KEYS = {
  apple: "appl_BpVXspbmCpzCXliDeOJlsGwbGIx", 
  google: "goog_YOUR_REVENUECAT_KEY_HERE"
};

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
      return customerInfo.entitlements.active['pro'] !== undefined;
    } catch (e) {
      return false;
    }
  }

  // Get the $4.99 Offer to display
  static async getOfferings() {
    try {
      const offerings = await Purchases.getOfferings();
      if (offerings.current !== null) {
        return offerings.current.availablePackages; // <--- RETURN ARRAY OF ALL PACKAGES
      }
      return [];
    } catch (e) {
      return [];
    }
  }

  // The "Buy Now" Action
  static async purchase(packageToBuy) {
    try {
      const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
      if (customerInfo.entitlements.active['pro']) {
        return true; // Success!
      }
    } catch (e) {
      if (!e.userCancelled) {
        Alert.alert("Purchase Error", e.message);
      }
    }
    return false;
  }

  // The "Restore Purchases" Action (Mandatory for Apple)
  static async restore() {
    try {
      const customerInfo = await Purchases.restorePurchases();
      return customerInfo.entitlements.active['pro'] !== undefined;
    } catch (e) {
      Alert.alert("Restore Error", e.message);
      return false;
    }
  }
}

export default SubscriptionManager;