import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Added for data safety
import * as Location from 'expo-location';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps'; // Removed PROVIDER_GOOGLE
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

const { width, height } = Dimensions.get('window');
const BACKGROUND_TRACKING_TASK = 'background-tracking-task'; 

// --- HELPER: Haversine Distance Calculation ---
function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8; // Radius of the earth in miles
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1); 
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in miles
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

export default function TrackScreen() {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(0); 
  const [earnings, setEarnings] = useState(0); 
  
  const mapRef = useRef(null);
  const subscriptionRef = useRef(null);

  useEffect(() => {
    (async () => {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      setIsTracking(hasStarted);

      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to track your trips.');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  const startTrip = async () => {
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert("Background Access Needed", "To track while your phone is locked, please select 'Always Allow' in settings.");
        return;
      }

      setIsTracking(true);
      setRouteCoordinates([]);
      setDistance(0);
      setEarnings(0);

      // Clear old background data
      await AsyncStorage.removeItem('pending_locations');

      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 5, 
        deferredUpdatesInterval: 1000, 
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "DriverPro Tracking",
          notificationBody: "Tracking your mileage...",
          notificationColor: COLORS.primary,
        },
      });

      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000, 
          distanceInterval: 5, 
        },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          const newCoordinate = { latitude, longitude };

          setLocation(newLocation);
          
          setRouteCoordinates((prevRoute) => {
             const newRoute = [...prevRoute, newCoordinate];
             
             // CALCULATE REAL DISTANCE
             if (prevRoute.length > 0) {
               const lastPoint = prevRoute[prevRoute.length - 1];
               const milesDelta = getDistanceFromLatLonInMiles(
                 lastPoint.latitude, lastPoint.longitude,
                 latitude, longitude
               );

               // Filter GPS Drift: Only count if movement is significant (> 10 feet approx)
               if (milesDelta > 0.002) {
                 setDistance(d => d + milesDelta);
                 setEarnings(e => e + (milesDelta * 0.675)); // 2025 IRS Rate
               }
             }
             return newRoute;
          });

          mapRef.current?.animateToRegion({
            latitude,
            longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          });
        }
      );
    } catch (error) {
      console.error("Start Trip Error:", error);
      Alert.alert("Error", "Could not start tracking engine.");
      setIsTracking(false);
    }
  };

  const stopTrip = async () => {
    setIsTracking(false);
    
    if (subscriptionRef.current) {
      await subscriptionRef.current.remove();
    }

    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    if (hasStarted) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    }

    try {
      // 1. Check for any background points stored by App.js
      const bgData = await AsyncStorage.getItem('pending_locations');
      
      // --- BACKGROUND MERGE LOGIC ---
      let finalRoute = [...routeCoordinates];
      
      if (bgData) {
        const bgPoints = JSON.parse(bgData);
        console.log(`Recovered ${bgPoints.length} background points.`);
        
        // Merge the background points into the final route
        // This ensures points tracked while the app was closed are saved
        finalRoute = [...finalRoute, ...bgPoints]; 
      }

      console.log("Saving trip to Firebase...");
      
      const docRef = await addDoc(collection(db, "trips"), {
        userId: auth.currentUser?.uid || "test_user_kaleb",
        miles: distance.toFixed(2),
        savings: earnings.toFixed(2),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString(),
        route: finalRoute // Saves the merged route
      });

      // Clear the pending locations so they don't appear in the next trip
      await AsyncStorage.removeItem('pending_locations');

      Alert.alert('Trip Saved', `Saved to cloud! ID: ${docRef.id}`);
      
    } catch (error) {
      console.error("FIREBASE SAVE ERROR:", error);
      Alert.alert('Save Failed', `Could not reach Firebase: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          // FIXED: Removed provider={PROVIDER_GOOGLE} to use default Apple Maps on iOS
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}
          followsUserLocation={true}
        >
          <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor={COLORS.primary} />
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Locating GPS...</Text>
        </View>
      )}

      <View style={styles.statsCard}>
        <View style={styles.statItem}>
           <Text style={styles.statLabel}>DISTANCE</Text>
           <Text style={styles.statValue}>{distance.toFixed(2)} <Text style={styles.unit}>mi</Text></Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
           <Text style={styles.statLabel}>TAX SAVINGS</Text>
           <Text style={[styles.statValue, { color: COLORS.success }]}>${earnings.toFixed(2)}</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.button, { backgroundColor: isTracking ? COLORS.danger : COLORS.success }]}
        onPress={isTracking ? stopTrip : startTrip}
      >
        <Ionicons name={isTracking ? "stop" : "play"} size={24} color="white" style={{ marginRight: 10 }} />
        <Text style={styles.buttonText}>{isTracking ? "STOP TRIP" : "START TRACKING"}</Text>
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width: width, height: height },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  loadingText: { color: 'white', fontSize: 18 },
  statsCard: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: '#1E1E1E',
    flexDirection: 'row',
    padding: 20,
    borderRadius: 15,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 10,
    borderWidth: 1,
    borderColor: '#333'
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  statValue: { color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  unit: { fontSize: 14, color: '#888' },
  divider: { width: 1, backgroundColor: '#333', marginHorizontal: 10 },
  button: {
    position: 'absolute',
    bottom: 100,
    alignSelf: 'center',
    width: '80%',
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 20,
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});