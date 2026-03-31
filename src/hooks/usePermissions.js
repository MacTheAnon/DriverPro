import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

export function usePermissions() {
  const [permissionStatus, setPermissionStatus] = useState({
    location: 'undetermined',
    camera: 'undetermined',
  });

  // FIX: Wrapped in useCallback so it's stable and doesn't get recreated on every render.
  // Previously it was a plain function inside the hook body, reconstructed each time.
  const showSettingsAlert = useCallback((title, message) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => Linking.openSettings() },
    ]);
  }, []);

  const requestLocation = useCallback(async (background = false) => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        showSettingsAlert(
          'Location Access Required',
          'DriverPro needs location access to track your mileage and calculate tax deductions.'
        );
        setPermissionStatus(p => ({ ...p, location: 'denied' }));
        return false;
      }

      if (background) {
        const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
        if (bgStatus !== 'granted') {
          showSettingsAlert(
            'Background Tracking',
            "To track trips automatically while your phone is locked, please select 'Always Allow' in Settings."
          );
          setPermissionStatus(p => ({ ...p, location: 'foreground_only' }));
          return false;
        }
      }

      setPermissionStatus(p => ({ ...p, location: 'granted' }));
      return true;
    } catch (e) {
      console.error('Location Permission Error', e);
      return false;
    }
  }, [showSettingsAlert]);

  const requestCamera = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showSettingsAlert(
          'Camera Access',
          'DriverPro needs camera access to scan your insurance and registration documents.'
        );
        setPermissionStatus(p => ({ ...p, camera: 'denied' }));
        return false;
      }
      setPermissionStatus(p => ({ ...p, camera: 'granted' }));
      return true;
    } catch (e) {
      console.error('Camera Permission Error', e);
      return false;
    }
  }, [showSettingsAlert]);

  return {
    permissionStatus,
    requestLocation,
    requestCamera,
  };
}
