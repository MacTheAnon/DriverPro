import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'; // Added Firebase
import { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { auth, db } from '../firebaseConfig'; // Added config import
import COLORS from '../styles/colors';

const { width, height } = Dimensions.get('window');

export default function TrackScreen() {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(0); // in miles
  const [earnings, setEarnings] = useState(0); // $0.675 per mile
  
  const mapRef = useRef(null);
  const subscriptionRef = useRef(null);

  // 1. Ask for Permission on Load
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Allow location access to track your trips.');
        return;
      }

      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, []);

  // 2. Start Tracking Function
  const startTrip = async () => {
    setIsTracking(true);
    setRouteCoordinates([]); // Reset path
    setDistance(0);
    setEarnings(0);

    // Watch position updates
    subscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 2000, // Update every 2 seconds
        distanceInterval: 10, // Update every 10 meters
      },
      (newLocation) => {
        const { latitude, longitude } = newLocation.coords;
        const newCoordinate = { latitude, longitude };

        setLocation(newLocation);
        
        // Add new point to the path line
        setRouteCoordinates((prevRoute) => {
           const newRoute = [...prevRoute, newCoordinate];
           
           // Calculate rough distance (Simplified for demo)
           if (prevRoute.length > 0) {
             // In a real app, we'd use the Haversine formula here
             // For this demo, we assume each update is roughly 0.01 miles for visual feedback
             setDistance(d => d + 0.01);
             setEarnings(e => e + (0.01 * 0.675));
           }
           return newRoute;
        });

        // Keep map centered on car
        mapRef.current?.animateToRegion({
          latitude,
          longitude,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        });
      }
    );
  };

  // 3. Stop Tracking Function (Saves to Firebase)
  const stopTrip = async () => {
    setIsTracking(false);
    
    // Stop the GPS watcher
    if (subscriptionRef.current) {
      await subscriptionRef.current.remove();
    }

    try {
      console.log("Saving trip to Firebase...");
      
      // Attempt to save to Firestore
      const docRef = await addDoc(collection(db, "trips"), {
        userId: auth.currentUser?.uid || "test_user_kaleb",
        miles: distance.toFixed(2),
        savings: earnings.toFixed(2),
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      console.log("Trip saved successfully with ID:", docRef.id);
      Alert.alert('Trip Saved', `Saved to cloud! ID: ${docRef.id}`);
      
    } catch (error) {
      console.error("FIREBASE SAVE ERROR:", error);
      Alert.alert('Save Failed', `Could not reach Firebase: ${error.message}`);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* THE MAP */}
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          initialRegion={{
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            latitudeDelta: 0.005,
            longitudeDelta: 0.005,
          }}
          showsUserLocation={true}
          followsUserLocation={true}
        >
          {/* Draw the Blue Path Line */}
          <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor={COLORS.primary} />
        </MapView>
      ) : (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Locating GPS...</Text>
        </View>
      )}

      {/* OVERLAY STATS CARD */}
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

      {/* START/STOP BUTTON */}
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