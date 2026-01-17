import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { auth } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function LoginScreen({ navigation }) {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biometricCompatible = await LocalAuthentication.hasHardwareAsync();
        setIsBiometricSupported(biometricCompatible);

        const appleCompatible = await AppleAuthentication.isAvailableAsync();
        setIsAppleAuthAvailable(appleCompatible);

        GoogleSignin.configure({
          // FIXED: Used the real Web Client ID from your google-services.json
          webClientId: '1083485928900-lg5i5ehmtcls7e5fo6s23qsc907ik24b.apps.googleusercontent.com', 
          offlineAccess: true,
          forceCodeForRefreshToken: true,
        });
      } catch (error) {
        console.error("Initial configuration failed:", error);
      }
    })();
  }, []);

  const handleBiometricAuth = async () => {
    try {
      const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
      if (!savedBiometrics) {
        return Alert.alert('Setup Required', 'No biometrics found. Enable them in your device settings.');
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access DriverPro',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        console.log("Biometric signature verified.");
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'An unexpected biometric error occurred.');
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      const { identityToken } = credential;
      if (identityToken) {
        const provider = new OAuthProvider('apple.com');
        const fbCredential = provider.credential({ idToken: identityToken });
        await signInWithCredential(auth, fbCredential);
      }
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Apple Auth Error', e.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;
      
      if (!idToken) throw new Error("Google ID Token not found.");

      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("User manually closed Google popup.");
      } else {
        Alert.alert("Google Sign-In Error", error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.logoSection}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.appName}>Driver<Text style={styles.appNameHighlight}>PRO</Text></Text>
        <Text style={styles.tagline}>Protection + Profit Platform</Text>
      </View>

      <View style={styles.buttonSection}>
        {isAppleAuthAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={styles.appleButton}
            onPress={handleAppleLogin}
          />
        )}

        <TouchableOpacity 
          style={styles.googleButton} 
          onPress={handleGoogleLogin}
          activeOpacity={0.8}
        >
          <Image 
            source={{ uri: 'https://upload.wikimedia.org/wikipedia/commons/5/53/Google_%22G%22_Logo.svg' }} 
            style={styles.gIcon} 
          />
          <Text style={styles.googleText}>Sign in with Google</Text>
        </TouchableOpacity>

        {isBiometricSupported && (
          <TouchableOpacity 
            onPress={handleBiometricAuth} 
            style={styles.faceIdContainer}
            activeOpacity={0.7}
          >
              <Ionicons 
                // FIXED: 'face-id' does not exist. Using 'scan-outline' which is valid.
                name={Platform.OS === 'ios' ? "scan-outline" : "finger-print"} 
                size={30} 
                color={COLORS.primary} 
              />
              <Text style={styles.faceIdText}>
                {Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint'}
              </Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
        <View style={styles.divider} />
        <Text style={styles.corpText}>© 2026 McIntosh Digital Solutions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24, justifyContent: 'space-between' },
  logoSection: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 60 },
  logo: { width: 180, height: 180, marginBottom: 25 },
  appName: { fontSize: 42, fontWeight: 'bold', color: 'white', letterSpacing: 1.5 },
  appNameHighlight: { color: COLORS.primary, fontStyle: 'italic' },
  tagline: { fontSize: 18, color: '#999', marginTop: 10, fontWeight: '500' },
  buttonSection: { width: '100%', paddingBottom: 60 },
  appleButton: { width: '100%', height: 60, marginBottom: 18 },
  googleButton: { 
    width: '100%', height: 60, backgroundColor: 'white', 
    borderRadius: 16, justifyContent: 'center', alignItems: 'center', 
    flexDirection: 'row', marginBottom: 25,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 6
  },
  gIcon: { width: 24, height: 24, marginRight: 18 },
  googleText: { color: '#000', fontWeight: '700', fontSize: 18 },
  faceIdContainer: { alignItems: 'center', padding: 15, flexDirection: 'row', justifyContent: 'center', marginTop: 15 },
  faceIdText: { color: COLORS.primary, fontSize: 18, fontWeight: '700', marginLeft: 15 },
  footer: { alignItems: 'center', marginBottom: 35 },
  legalText: { color: '#666', fontSize: 13, textAlign: 'center', lineHeight: 20 },
  divider: { height: 1, width: 50, backgroundColor: '#333', marginVertical: 15 },
  corpText: { color: '#444', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 }
});