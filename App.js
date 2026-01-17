// App.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';
import { onAuthStateChanged } from 'firebase/auth';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Image, LogBox, StyleSheet, View } from 'react-native';

import { auth } from './src/firebaseConfig';
import DashboardScreen from './src/screens/DashboardScreen';
import DocumentUploadScreen from './src/screens/DocumentUploadScreen';
import LoginScreen from './src/screens/LoginScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackScreen from './src/screens/TrackScreen';
import WalletScreen from './src/screens/WalletScreen';

LogBox.ignoreLogs(['Setting a timer']);

const BACKGROUND_TRACKING_TASK = 'background-tracking-task';
const GEOFENCE_TASK = 'geofence-tracking-task';

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, ({ data, error }) => {
  if (error) { console.error("Background Tracking Error:", error); return; }
  if (data) { console.log("Background location received:", data.locations); }
});

TaskManager.defineTask(GEOFENCE_TASK, ({ data: { eventType, region }, error }) => {
  if (error) { console.error("Geofence Error:", error); return; }
  console.log("Geofence Event:", eventType, region.identifier);
});

SplashScreen.preventAutoHideAsync();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: { backgroundColor: '#1E1E1E', borderTopColor: '#333', height: 65, paddingBottom: 10, paddingTop: 10, position: 'absolute' },
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
    const unsubscribeAuth = onAuthStateChanged(auth, (authenticatedUser) => {
      setUser(authenticatedUser);
    });

    async function prepare() {
      try {
        await Font.loadAsync({ ...Ionicons.font });
        await new Promise(resolve => setTimeout(resolve, 2500));
      } catch (e) { console.warn(e); } finally { setAppIsReady(true); }
    }
    prepare();
    return () => { if (unsubscribeAuth) unsubscribeAuth(); };
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
      Animated.timing(fadeAnim, { toValue: 0, duration: 1000, useNativeDriver: true }).start();
    }
  }, [appIsReady, fadeAnim]);

  if (!appIsReady) return null;

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }} onLayout={onLayoutRootView}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            <>
              <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
              <Stack.Screen name="Dashboard" component={MainTabNavigator} />
              <Stack.Screen name="Settings" component={SettingsScreen} />
            </>
          ) : (
            <Stack.Screen name="Login" component={LoginScreen} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#121212', opacity: fadeAnim, justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
        <Image source={require('./assets/logo.png')} style={{ width: 180, height: 180, resizeMode: 'contain' }} />
      </Animated.View>
    </View>
  );
}