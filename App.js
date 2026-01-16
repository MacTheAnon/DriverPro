import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import * as Location from 'expo-location';
import * as SplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, LogBox, StyleSheet, View } from 'react-native';

// --- FIREBASE CONFIG ---
import { auth } from './src/firebaseConfig';

// --- IMPORT ALL SCREENS ---
import DashboardScreen from './src/screens/DashboardScreen';
import DocumentUploadScreen from './src/screens/DocumentUploadScreen';
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackScreen from './src/screens/TrackScreen';
import WalletScreen from './src/screens/WalletScreen';

// Ignore specific warnings for a cleaner console
LogBox.ignoreLogs(['Setting a timer']);

// --- BACKGROUND TASK DEFINITIONS ---
const BACKGROUND_TRACKING_TASK = 'background-tracking-task';
const GEOFENCE_TASK = 'geofence-tracking-task';

// 1. GPS Tracking Task
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, ({ data, error }) => {
  if (error) {
    console.error("Background Tracking Error:", error);
    return;
  }
  if (data) {
    const { locations } = data;
    console.log("Background location received:", locations);
  }
});

// 2. Geofencing Task
TaskManager.defineTask(GEOFENCE_TASK, ({ data: { eventType, region }, error }) => {
  if (error) {
    console.error("Geofence Error:", error);
    return;
  }
  if (eventType === Location.GeofencingEventType.Exit) {
    console.log("Exited Home Geofence - Starting Auto-Track:", region.identifier);
  } else if (eventType === Location.GeofencingEventType.Enter) {
    console.log("Entered Home Geofence - Ending Auto-Track:", region.identifier);
  }
});

// --- CONFIGURATION ---
SplashScreen.preventAutoHideAsync();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { 
            backgroundColor: '#1E1E1E', 
            borderTopColor: '#333',
            height: 65,
            paddingBottom: 10,
            paddingTop: 10,
            position: 'absolute'
        },
        tabBarActiveTintColor: '#2D6CDF',
        tabBarInactiveTintColor: 'gray',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') iconName = focused ? 'grid' : 'grid-outline';
          else if (route.name === 'Track') iconName = focused ? 'navigate' : 'navigate-outline';
          else if (route.name === 'Wallet') iconName = focused ? 'card' : 'card-outline';
          return <Ionicons name={iconName} size={24} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Track" component={TrackScreen} />
      <Tab.Screen name="Wallet" component={WalletScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    // A. Listen for Auth Changes
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
    });

    async function prepare() {
      try {
        // B. Load Fonts
        await Font.loadAsync({
          ...Ionicons.font,
        });
        
        // C. Delay for Splash Branding
        await new Promise(resolve => setTimeout(resolve, 2500));
        
      } catch (e) {
        console.warn(e);
      } finally {
        setAppIsReady(true);
      }
    }

    prepare();
    return () => {
      if (unsubscribeAuth) unsubscribeAuth();
    };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
      
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }).start();
    }
  }, [appIsReady, fadeAnim]);

  if (!appIsReady) {
    return null;
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }} onLayout={onLayoutRootView}>
      
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              {/* Prioritize document verification for new sessions */}
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
              <Stack.Screen name="Dashboard" component={MainTabNavigator} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>

      {/* CUSTOM ANIMATED SPLASH OVERLAY */}
      <Animated.View 
        pointerEvents="none" 
        style={[
          StyleSheet.absoluteFill, 
          { backgroundColor: '#121212', opacity: fadeAnim, justifyContent: 'center', alignItems: 'center', zIndex: 999 }
        ]}
      >
        <Image 
            source={require('./assets/logo.png')} 
            style={{ width: 180, height: 180, resizeMode: 'contain' }} 
        />
      </Animated.View>

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