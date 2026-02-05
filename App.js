import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useContext, useEffect, useState } from 'react';
import { Animated, Image, LogBox, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Context & Auth
import { UserContext, UserProvider } from './src/context/UserContext';

// Screens
import ChatScreen from './src/screens/ChatScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import DocumentUploadScreen from './src/screens/DocumentUploadScreen';
import DocumentsScreen from './src/screens/DocumentsScreen';
import LoginScreen from './src/screens/LoginScreen';
import PremiumScreen from './src/screens/PremiumScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import TrackScreen from './src/screens/TrackScreen';
import WalletScreen from './src/screens/WalletScreen';

LogBox.ignoreLogs(['Setting a timer']);

const BACKGROUND_TRACKING_TASK = 'background-tracking-task';
const GEOFENCE_TASK = 'geofence-tracking-task';

// --- BACKGROUND TASKS ---
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) { 
    console.error("Background Tracking Error:", error); 
    return; 
  }
  if (data) {
    const { locations } = data;
    try {
      const existingData = await AsyncStorage.getItem('pending_locations');
      const pendingPoints = existingData ? JSON.parse(existingData) : [];
      const updatedPoints = [...pendingPoints, ...locations];
      await AsyncStorage.setItem('pending_locations', JSON.stringify(updatedPoints));
      console.log(`Background: Saved ${locations.length} new points.`);
    } catch (err) {
      console.error("Failed to save background location", err);
    }
  }
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

// Helper Component for Navigation Logic
const AppNavigation = () => {
  const { user, loading } = useContext(UserContext); 

  if (loading) return null; 

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Group>
            <Stack.Screen name="Dashboard" component={MainTabNavigator} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
            <Stack.Screen name="Documents" component={DocumentsScreen} />
            <Stack.Screen name="Settings" component={SettingsScreen} />
            <Stack.Screen name="Premium" component={PremiumScreen} options={{ presentation: 'modal', headerShown: false }} />
          </Stack.Group>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    async function prepare() {
      try {
        await Font.loadAsync({ ...Ionicons.font });
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) { console.warn(e); } finally { setAppIsReady(true); }
    }
    prepare();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) { 
      await SplashScreen.hideAsync();
      Animated.timing(fadeAnim, { toValue: 0, duration: 1000, useNativeDriver: true }).start();
    }
  }, [appIsReady, fadeAnim]);

  if (!appIsReady) return null; 

  return (
    <UserProvider> 
      <SafeAreaProvider>
        <View style={{ flex: 1, backgroundColor: '#121212' }} onLayout={onLayoutRootView}>
          <AppNavigation /> 
          
          {/* Splash Overlay */}
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#121212', opacity: fadeAnim, justifyContent: 'center', alignItems: 'center', zIndex: 999 }]}>
            <Image source={require('./assets/logo.png')} style={{ width: 180, height: 180, resizeMode: 'contain' }} />
          </Animated.View>
        </View>
      </SafeAreaProvider>
    </UserProvider>
  );
}