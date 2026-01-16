import { Ionicons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as LocalAuthentication from 'expo-local-authentication';
import { StatusBar } from 'expo-status-bar';
import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
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
        // 1. Check for FaceID / Fingerprint hardware support
        const biometricCompatible = await LocalAuthentication.hasHardwareAsync();
        setIsBiometricSupported(biometricCompatible);

        // 2. Check if Apple Sign In is available on this platform/version
        const appleCompatible = await AppleAuthentication.isAvailableAsync();
        setIsAppleAuthAvailable(appleCompatible);

        // 3. Configure Google Sign-In with Firebase Web Client ID
        // Note: You must replace the string below with your actual ID from Firebase Console
        GoogleSignin.configure({
          webClientId: 'YOUR_FIREBASE_WEB_CLIENT_ID.apps.googleusercontent.com', 
          offlineAccess: true,
          forceCodeForRefreshToken: true,
        });
      } catch (error) {
        console.error("Initialization Error:", error);
      }
    })();
  }, []);

  // --- HANDLE BIOMETRIC LOGIN ---
  const handleBiometricAuth = async () => {
    try {
      const savedBiometrics = await LocalAuthentication.isEnrolledAsync();
      if (!savedBiometrics) {
        return Alert.alert(
          'Biometrics Not Found', 
          'Please enable FaceID or Fingerprint in your device settings to use this feature.'
        );
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Authenticate to access DriverPro',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        // SUCCESS: onAuthStateChanged in App.js will handle the transition
        console.log("Biometric Authentication Successful");
      } else {
        // Handle specific failure cases if needed
        if (result.error !== 'user_cancel') {
          Alert.alert('Authentication Failed', 'We could not verify your identity.');
        }
      }
    } catch (error) {
      console.error("Biometric Error:", error);
      Alert.alert('Error', 'An unexpected error occurred during biometric login.');
    }
  };

  // --- HANDLE APPLE LOGIN ---
  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      
      console.log("Apple Sign-In Success, creating Firebase credential...");
      
      // Create a Firebase credential from the Apple ID token
      const { identityToken } = credential;
      if (identityToken) {
        const provider = new OAuthProvider('apple.com');
        const fbCredential = provider.credential({
          idToken: identityToken,
        });
        await signInWithCredential(auth, fbCredential);
      }
    } catch (e) {
      if (e.code === 'ERR_REQUEST_CANCELED') {
        console.log("User cancelled Apple Sign-In");
      } else {
        console.error("Apple Auth Error:", e);
        Alert.alert('Apple Login Error', e.message);
      }
    }
  };

  // --- HANDLE GOOGLE LOGIN ---
  const handleGoogleLogin = async () => {
    try {
      // Check if Play Services are available (essential for Android)
      await GoogleSignin.hasPlayServices();
      
      // Trigger the Google Sign-In flow
      const response = await GoogleSignin.signIn();
      
      // Extract the idToken from the response
      const idToken = response.data?.idToken;
      
      if (!idToken) {
        throw new Error("No ID Token found from Google Sign-In");
      }

      // Create Firebase credential and sign in
      const googleCredential = GoogleAuthProvider.credential(idToken);
      await signInWithCredential(auth, googleCredential);
      
      console.log("Google Login Success");
    } catch (error) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log("User cancelled Google login");
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log("Google Sign-In already in progress");
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        Alert.alert("Error", "Google Play Services are not available or outdated.");
      } else {
        console.error("Detailed Google Error:", error);
        Alert.alert("Google Login Error", error.message);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* BRANDING SECTION */}
      <View style={styles.logoSection}>
        <Image 
          source={require('../../assets/logo.png')} 
          style={styles.logo} 
          resizeMode="contain"
        />
        <Text style={styles.appName}>Driver<Text style={styles.appNameHighlight}>PRO</Text></Text>
        <Text style={styles.tagline}>Protection + Profit Platform</Text>
      </View>

      {/* BUTTON SECTION */}
      <View style={styles.buttonSection}>
        
        {/* APPLE LOGIN */}
        {isAppleAuthAvailable && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleLogin}
          />
        )}

        {/* GOOGLE LOGIN */}
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

        {/* BIOMETRICS */}
        {isBiometricSupported && (
          <TouchableOpacity 
            onPress={handleBiometricAuth} 
            style={styles.faceIdContainer}
            activeOpacity={0.7}
          >
              <Ionicons 
                name={Platform.OS === 'ios' ? "face-id" : "finger-print"} 
                size={28} 
                color={COLORS.primary} 
              />
              <Text style={styles.faceIdText}>
                {Platform.OS === 'ios' ? 'Login with Face ID' : 'Login with Fingerprint'}
              </Text>
          </TouchableOpacity>
        )}

      </View>

      {/* FOOTER */}
      <View style={styles.footer}>
        <Text style={styles.legalText}>By continuing, you agree to our Terms & Privacy Policy.</Text>
        <View style={styles.divider} />
        <Text style={styles.corpText}>© 2026 McIntosh Digital Solutions</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: COLORS.background, 
    padding: 24, 
    justifyContent: 'space-between' 
  },
  logoSection: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    marginTop: 60 
  },
  logo: { 
    width: 170, 
    height: 170, 
    marginBottom: 25 
  },
  appName: { 
    fontSize: 40, 
    fontWeight: 'bold', 
    color: 'white', 
    letterSpacing: 1.5 
  },
  appNameHighlight: { 
    color: COLORS.primary, 
    fontStyle: 'italic' 
  },
  tagline: { 
    fontSize: 17, 
    color: '#999', 
    marginTop: 10,
    fontWeight: '500' 
  },
  buttonSection: { 
    width: '100%', 
    paddingBottom: 50 
  },
  appleButton: { 
    width: '100%', 
    height: 58, 
    marginBottom: 16 
  },
  googleButton: { 
    width: '100%', 
    height: 58, 
    backgroundColor: 'white', 
    borderRadius: 14, 
    justifyContent: 'center', 
    alignItems: 'center', 
    flexDirection: 'row', 
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  gIcon: { 
    width: 22, 
    height: 22, 
    marginRight: 16 
  },
  googleText: { 
    color: '#000', 
    fontWeight: '700', 
    fontSize: 17 
  },
  faceIdContainer: { 
    alignItems: 'center', 
    padding: 15, 
    flexDirection: 'row', 
    justifyContent: 'center',
    marginTop: 10
  },
  faceIdText: { 
    color: COLORS.primary, 
    fontSize: 17, 
    fontWeight: '700', 
    marginLeft: 12 
  },
  footer: { 
    alignItems: 'center', 
    marginBottom: 30 
  },
  legalText: { 
    color: '#666', 
    fontSize: 12, 
    textAlign: 'center', 
    lineHeight: 18 
  },
  divider: {
    height: 1,
    width: 40,
    backgroundColor: '#333',
    marginVertical: 12
  },
  corpText: { 
    color: '#444', 
    fontSize: 11, 
    fontWeight: '800',
    letterSpacing: 1
  }
});