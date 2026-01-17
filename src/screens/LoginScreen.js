import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { GoogleAuthProvider, OAuthProvider, signInWithCredential } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { Alert, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebaseConfig';
import COLORS from '../styles/colors';

// ⚠️ REPLACE WITH YOUR ACTUAL CLIENT ID FROM GOOGLE CLOUD CONSOLE
const GOOGLE_WEB_CLIENT_ID = '1083485928900-lg5i5ehmtcls7e5fo6s23qsc907ik24b.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const [isBiometricSupported, setIsBiometricSupported] = useState(false);
  const [isAppleAuthAvailable, setIsAppleAuthAvailable] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const biometricCompatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        setIsBiometricSupported(biometricCompatible && enrolled);

        const appleCompatible = await AppleAuthentication.isAvailableAsync();
        setIsAppleAuthAvailable(appleCompatible);

        GoogleSignin.configure({
          webClientId: GOOGLE_WEB_CLIENT_ID, 
          offlineAccess: true,
        });
      } catch (error) {
        console.error("Initial configuration failed:", error);
      }
    })();
  }, []);

  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access DriverPro',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // In a real app, you would retrieve a stored token here.
        // For this demo, we can't "auto-login" without a token storage strategy.
        // We will just alert for now or trigger a token refresh if available.
        Alert.alert("Verified", "Biometrics accepted. (Token logic needed for full login)");
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Biometric authentication failed.');
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
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
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
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  scrollContainer: { flexGrow: 1, justifyContent: 'space-between', padding: 24, paddingBottom: 40 },
  
  logoSection: { alignItems: 'center', marginTop: 40, marginBottom: 40 },
  logo: { width: 160, height: 160, marginBottom: 20 },
  appName: { fontSize: 42, fontWeight: 'bold', color: 'white', letterSpacing: 1.5 },
  appNameHighlight: { color: COLORS.primary, fontStyle: 'italic' },
  tagline: { fontSize: 16, color: '#999', marginTop: 10, fontWeight: '500', textAlign: 'center' },
  
  buttonSection: { width: '100%', marginBottom: 30 },
  appleButton: { width: '100%', height: 55, marginBottom: 15 },
  googleButton: { 
    width: '100%', height: 55, backgroundColor: 'white', 
    borderRadius: 14, justifyContent: 'center', alignItems: 'center', 
    flexDirection: 'row', marginBottom: 20,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4.65, elevation: 6
  },
  gIcon: { width: 24, height: 24, marginRight: 15 },
  googleText: { color: '#000', fontWeight: '700', fontSize: 17 },
  faceIdContainer: { alignItems: 'center', padding: 10, flexDirection: 'row', justifyContent: 'center' },
  faceIdText: { color: COLORS.primary, fontSize: 17, fontWeight: '700', marginLeft: 10 },
  
  footer: { alignItems: 'center' },
  legalText: { color: '#666', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 15 },
  divider: { height: 1, width: 40, backgroundColor: '#333', marginBottom: 15 },
  corpText: { color: '#444', fontSize: 11, fontWeight: '800', letterSpacing: 1 }
});