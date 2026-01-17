import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

export function usePermissions() {
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'undetermined',
    camera: 'undetermined',
  });

  // 1. Universal Helper for "Open Settings" Alerts
  const showSettingsAlert = (title, message) => {
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Open Settings", onPress: () => Linking.openSettings() }
    ]);
  };

  // 2. Robust Location Request (Foreground + Background)
  const requestLocation = useCallback(async (background = false) => {
    try {
      // Step A: Foreground (While app is open)
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showSettingsAlert(
          "Location Access Required", 
          "DriverPro needs location access to track your mileage and calculate tax deductions."
        );
        setPermissionStatus(p => ({ ...p, location: 'denied' }));
        return false;
      }

      // Step B: Background (Always Allow) - Critical for automatic tracking
      if (background) {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          showSettingsAlert(
            "Background Tracking", 
            "To track trips automatically while your phone is locked, please select 'Always Allow' in Settings."
          );
          setPermissionStatus(p => ({ ...p, location: 'foreground_only' }));
          return false;
        }
      }

      setPermissionStatus(p => ({ ...p, location: 'granted' }));
      return true;
    } catch (e) {
      console.error("Location Permission Error", e);
      return false;
    }
  }, []);

  // 3. Camera Request (For Documents)
  const requestCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showSettingsAlert(
          "Camera Access", 
          "DriverPro needs camera access to scan your insurance and registration documents."
        );
        setPermissionStatus(p => ({ ...p, camera: 'denied' }));
        return false;
      }
      setPermissionStatus(p => ({ ...p, camera: 'granted' }));
      return true;
    } catch (e) {
      console.error("Camera Permission Error", e);
      return false;
    }
  }, []);

  return {
    permissionStatus,
    requestLocation,
    requestCamera
  };
}