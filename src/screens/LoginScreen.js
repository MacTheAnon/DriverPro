import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import COLORS from '../styles/colors';

export default function LoginScreen({ navigation }) {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      // 1. Check for FaceID / Fingerprint support (Works on Android & iOS)
      const biometricCompatible = await LocalAuthentication.hasHardwareAsync();
      setIsBiometricSupported(biometricCompatible);

      // 2. Check if Apple Sign In is available (False on Android usually)
      const appleCompatible = await AppleAuthentication.isAvailableAsync();
      setIsAppleAuthAvailable(appleCompatible);
    })();
  }, []);

  // Handle Biometric Login
  const handleBiometricAuth = async () => {
    const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
    if (!savedBiometrics) return Alert.alert('Biometrics not set up', 'Please set up FaceID/Fingerprint in your settings.');

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Login to DriverPro',
      fallbackLabel: 'Use Passcode',
    });

    if (result.success) {
      navigation.replace('DocumentUpload'); 
    } else {
      Alert.alert('Authentication Failed');
    }
  };

  // Handle Apple Login
  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      navigation.replace('DocumentUpload');
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Login Error', e.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* BRANDING */}
      <View style={styles.logoSection}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.appName}>Driver<Text style={styles.appNameHighlight}>PRO</Text></Text>
        <Text style={styles.tagline}>Protection + Profit Platform</Text>
      </View>

      {/* BUTTONS */}
      <View style={styles.buttonSection}>
        
        {/* APPLE SIGN IN - Only shows if available (iOS) */}
        {isAppleAuthAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={10}
            style={styles.appleButton}
            onPress={handleAppleLogin}
          />
        )}

        {/* GOOGLE SIGN IN - Shows on All Platforms */}
        {/* On Android, this will be the primary login method */}
        <TouchableOpacity style={styles.googleButton} onPress={() => Alert.alert('Google Login', 'Coming in Phase 2')}>
          <Text style={styles.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        {/* BIOMETRICS - Shows on both Android (Fingerprint) and iOS (FaceID) */}
        {isBiometricSupported && (
          <TouchableOpacity onPress={handleBiometricAuth} style={styles.faceIdContainer}>
             <Text style={styles.faceIdText}>
               {Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint'}
             </Text>
          </TouchableOpacity>
        )}

      </View>

      <View style={styles.footer}>
        <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20, justifyContent: 'space-between' },
  logoSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 50 },
  logo: { width: 150, height: 150, marginBottom: 20 },
  appName: { fontSize: 32, fontWeight: 'bold', color: 'white', letterSpacing: 1 },
  appNameHighlight: { color: COLORS.primary, fontStyle: 'italic' },
  tagline: { fontSize: 16, color: '#888', marginTop: 5 },
  
  buttonSection: { width: '100%', paddingBottom: 30 },
  appleButton: { width: '100%', height: 50, marginBottom: 15 },
  googleButton: { 
    width: '100%', height: 50, backgroundColor: COLORS.card, 
    borderRadius: 10, justifyContent: 'center', alignItems: 'center', 
    borderWidth: 1, borderColor: '#333', marginBottom: 20 
  },
  googleText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  faceIdContainer: { alignItems: 'center', padding: 10 },
  faceIdText: { color: COLORS.primary, fontSize: 16 },

  footer: { alignItems: 'center', marginBottom: 20 },
  legalText: { color: '#555', fontSize: 10, textAlign: 'center' }
});