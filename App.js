import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { onAuthStateChanged } from 'firebase/auth'; // Real Auth Listener
import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, StyleSheet, View } from 'react-native';

// --- FIREBASE CONFIG ---
import { auth } from './src/firebaseConfig';

// --- IMPORT ALL SCREENS ---
import DashboardScreen from './src/screens/DashboardScreen';
import DocumentUploadScreen from './src/screens/DocumentUploadScreen';
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackScreen from './src/screens/TrackScreen';
import WalletScreen from './src/screens/WalletScreen';

// --- CONFIGURATION ---
SplashScreen.preventAutoHideAsync();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// --- 1. THE MAIN TAB NAVIGATOR ---
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
            backgroundColor: '#1E1E1E', 
            borderTopColor: '#333',
            height: 60,
            paddingBottom: 8,
            paddingTop: 8
        },
        tabBarActiveTintColor: '#2D6CDF',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Track') iconName = focused ? 'navigate' : 'navigate-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'card' : 'card-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
    </Tab.Navigator>
  );
}

// --- 2. THE APP ENTRY POINT ---
export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [user, setUser] = useState(null); // Track real login state
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // A. Listen for Auth Changes (Login/Logout)
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
    });

    async function prepare() {
      try {
        // B. Load Fonts
        await Font.loadAsync({
             ...Ionicons.font,
        });
        
        // C. Artificial delay for Splash Branding
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
    return unsubscribeAuth; // Clean up listener on unmount
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
      
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [appIsReady]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }} onLayout={onLayoutRootView}>
      
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            // --- PROTECTED APP STACK ---
            <>
              <Stack.Screen name="Dashboard" component={MainTabNavigator} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
            </>
          ) : (
            // --- AUTH STACK ---
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* CUSTOM SPLASH OVERLAY */}
      <Animated.View 
        pointerEvents="none" 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: '#121212', opacity: fadeAnim, justifyContent: 'center', alignItems: 'center' }
        ]}
      >
        <Image 
            source={require('./assets/logo.png')} 
            style={{ width: 150, height: 150, resizeMode: 'contain' }} 
        />
      </Animated.View>

    </View>
  );
}