import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, Modal, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { UserContext } from '../context/UserContext';
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
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; 
  return d;
}

function deg2rad(deg) {
  return deg * (Math.PI/180);
}

// --- FEATURE: Frequent Places Logic (Mock) ---
const checkFrequentPlaces = (coords) => {
  // In a real app, you would compare 'coords' against a list of saved Places in Firestore
  const HOME_LAT = 38.9717; 
  const HOME_LON = -94.6174;
  const dist = getDistanceFromLatLonInMiles(coords.latitude, coords.longitude, HOME_LAT, HOME_LON);
  if (dist < 0.2) return "Home Base";
  return null;
};

export default function TrackScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  
  // Trip Stats
  const [distance, setDistance] = useState(0); 
  const [earnings, setEarnings] = useState(0); 
  const [gigEarnings, setGigEarnings] = useState(''); 
  const [netProfit, setNetProfit] = useState(0); 

  // Vehicle & Schedule Stats
  const [totalOdometer, setTotalOdometer] = useState(0);
  const [smartSchedule, setSmartSchedule] = useState(null); // <--- LOADED FROM DB
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [manualOdometerInput, setManualOdometerInput] = useState('');

  const { isPremium } = useContext(UserContext); 
  const mapRef = useRef(null);
  const subscriptionRef = useRef(null);
  const user = auth.currentUser;

  // --- 1. Load User Data on Start ---
  useEffect(() => {
    if (user) {
      getDoc(doc(db, "users", user.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTotalOdometer(parseFloat(data.currentOdometer || 0));
          setSmartSchedule(data.schedule); // <--- Load Schedule Settings
        }
      });
    }

    // Location Permissions
    (async () => {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      setIsTracking(hasStarted);
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();
  }, [user]);

  // --- 2. Update Odometer Function ---
  const handleSetOdometer = async () => {
    const val = parseFloat(manualOdometerInput);
    if (!val || val < 0) return Alert.alert("Invalid Input", "Please enter a valid number.");
    
    setTotalOdometer(val);
    setShowOdometerModal(false);
    
    // Save to DB
    if (user) {
      await setDoc(doc(db, "users", user.uid), { currentOdometer: val }, { merge: true });
      Alert.alert("Success", `Odometer set to ${val.toLocaleString()} miles.`);
    }
  };

  const startTrip = async () => {
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert("Background Access Needed", "Select 'Always Allow' to track in background.");
        return;
      }

      setIsTracking(true);
      setRouteCoordinates([]);
      setDistance(0);
      setEarnings(0);
      setGigEarnings('');
      setNetProfit(0);

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
        { accuracy: Location.Accuracy.High, distanceInterval: 5 },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          const newCoordinate = { latitude, longitude };
          setLocation(newLocation);
          
          setRouteCoordinates((prevRoute) => {
             const newRoute = [...prevRoute, newCoordinate];
             if (prevRoute.length > 0) {
               const lastPoint = prevRoute[prevRoute.length - 1];
               const milesDelta = getDistanceFromLatLonInMiles(lastPoint.latitude, lastPoint.longitude, latitude, longitude);

               if (milesDelta > 0.002) { // Filter GPS noise
                 setDistance(d => {
                    const newDist = d + milesDelta;
                    // Real-time Profit Calc
                    const estimatedExpense = newDist * 0.30; 
                    const currentGross = parseFloat(gigEarnings) || 0;
                    setNetProfit(currentGross - estimatedExpense);
                    return newDist;
                 });
                 setEarnings(e => e + (milesDelta * 0.67)); 
               }
             }
             return newRoute;
          });

          mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 });
        }
      );
    } catch (error) {
      setIsTracking(false);
    }
  };

  const stopTrip = async () => {
    setIsTracking(false);
    if (subscriptionRef.current) await subscriptionRef.current.remove();
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    if (hasStarted) await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);

    try {
      const bgData = await AsyncStorage.getItem('pending_locations');
      let finalRoute = [...routeCoordinates];
      if (bgData) finalRoute = [...finalRoute, ...JSON.parse(bgData)]; 

      // --- SMART CLASSIFICATION (LINKED TO SETTINGS) ---
      let type = 'Personal';
      
      if (isPremium && smartSchedule && smartSchedule.enabled) {
        const now = new Date();
        const currentMins = (now.getHours() * 60) + now.getMinutes();
        
        // Parse "09:00" -> 540 minutes
        const [startH, startM] = smartSchedule.start.split(':').map(Number);
        const [endH, endM] = smartSchedule.end.split(':').map(Number);
        const startMins = (startH * 60) + startM;
        const endMins = (endH * 60) + endM;

        if (currentMins >= startMins && currentMins <= endMins) {
          type = 'Business';
        }
      }

      let startName = "Unknown";
      if (finalRoute.length > 0) {
        const place = checkFrequentPlaces(finalRoute[0]);
        if (place) startName = place;
      }

      if (!user) return;

      // Save Trip
      await addDoc(collection(db, "trips"), {
        userId: user.uid,
        miles: distance.toFixed(2),
        savings: earnings.toFixed(2),
        type: type, // Uses the Smart Schedule result
        grossEarnings: gigEarnings || "0",
        netProfit: netProfit.toFixed(2),
        startLocation: startName,
        timestamp: serverTimestamp(),
        route: finalRoute
      });

      // --- MAINTENANCE LOGIC ---
      const newOdometer = totalOdometer + distance;
      setTotalOdometer(newOdometer);
      
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        currentOdometer: newOdometer,    
        totalTrackedMiles: increment(distance) 
      });

      checkMaintenance(newOdometer);

      await AsyncStorage.removeItem('pending_locations');
      
      // Notify User
      if (type === 'Business') {
        Alert.alert('Trip Auto-Tagged 🤖', `Logged as Business Trip based on your schedule.\nSavings: $${earnings.toFixed(2)}`);
      } else {
        Alert.alert('Trip Saved', `Logged as Personal.\nSavings: $${earnings.toFixed(2)}`);
      }
      
    } catch (error) {
      console.error(error);
    }
  };

  // --- 3. The Mechanic Logic ---
  const checkMaintenance = (odometer) => {
    // Rotation every 6,000 miles
    if (Math.floor(odometer / 6000) > Math.floor((odometer - distance) / 6000)) {
       Alert.alert("Service Alert 🔧", "You've hit a 6,000 mile interval. Time for a Tire Rotation!");
    }
    // Tires every 50,000 miles
    if (Math.floor(odometer / 50000) > Math.floor((odometer - distance) / 50000)) {
       Alert.alert("Major Service ⚠️", "You've hit 50,000 miles. Check your Tire Tread and Brakes.");
    }
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{ latitude: location.coords.latitude, longitude: location.coords.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
          showsUserLocation={true}
          followsUserLocation={true}
        >
          <Polyline coordinates={routeCoordinates} strokeWidth={5} strokeColor={COLORS.primary} />
        </MapView>
      ) : (
        <View style={styles.loadingContainer}><Text style={styles.loadingText}>Locating GPS...</Text></View>
      )}

      {/* STATS CARD */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
           <Text style={styles.statLabel}>TRIP MILES</Text>
           <Text style={styles.statValue}>{distance.toFixed(2)} <Text style={styles.unit}>mi</Text></Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
           <Text style={styles.statLabel}>TAX SAVINGS</Text>
           <Text style={[styles.statValue, { color: COLORS.success }]}>${earnings.toFixed(2)}</Text>
        </View>
      </View>

      {/* ODOMETER BAR (Clickable) */}
      <TouchableOpacity style={styles.odometerContainer} onPress={() => setShowOdometerModal(true)}>
        <Ionicons name="speedometer-outline" size={16} color="#888" style={{marginRight: 8}} />
        <Text style={styles.odometerText}>
          Odometer: <Text style={{color: 'white', fontWeight: 'bold'}}>{totalOdometer.toLocaleString(undefined, {maximumFractionDigits: 1})} mi</Text>
        </Text>
        <Ionicons name="pencil" size={12} color="#888" style={{marginLeft: 8}} />
      </TouchableOpacity>
      
      {/* PROFIT MODE INPUT */}
      {isTracking && (
        <View style={styles.profitCard}>
          <Text style={styles.profitLabel}>CURRENT GIG EARNINGS</Text>
          <View style={styles.inputRow}>
            <Text style={styles.dollarSign}>$</Text>
            <TextInput 
              style={styles.profitInput}
              placeholder="0.00"
              placeholderTextColor="#555"
              keyboardType="numeric"
              value={gigEarnings}
              onChangeText={(text) => {
                setGigEarnings(text);
                const gross = parseFloat(text) || 0;
                const expense = distance * 0.30; 
                setNetProfit(gross - expense);
              }}
            />
          </View>
          <Text style={styles.netProfitText}>
            Real Profit: <Text style={{color: netProfit >= 0 ? COLORS.success : COLORS.danger}}>${netProfit.toFixed(2)}</Text>
          </Text>
        </View>
      )}

      {/* START/STOP BUTTON */}
      <TouchableOpacity 
        style={[styles.button, { backgroundColor: isTracking ? COLORS.danger : COLORS.success }]}
        onPress={isTracking ? stopTrip : startTrip}
      >
        <Ionicons name={isTracking ? "stop" : "play"} size={24} color="white" style={{ marginRight: 10 }} />
        <Text style={styles.buttonText}>{isTracking ? "STOP TRIP" : "START TRACKING"}</Text>
      </TouchableOpacity>

      {/* ODOMETER INPUT MODAL */}
      <Modal visible={showOdometerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Set Odometer</Text>
            <Text style={styles.modalSub}>Enter your vehicle's current mileage to track maintenance.</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 45000"
              placeholderTextColor="#666"
              keyboardType="numeric"
              value={manualOdometerInput}
              onChangeText={setManualOdometerInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowOdometerModal(false)} style={styles.cancelBtn}>
                <Text style={{color: '#aaa'}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetOdometer} style={styles.saveBtn}>
                <Text style={{color: 'white', fontWeight: 'bold'}}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

  // Odometer Bar
  odometerContainer: {
    position: 'absolute',
    top: 145, // Below Stats Card
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333'
  },
  odometerText: { color: '#ccc', fontSize: 12 },

  // Profit Card
  profitCard: {
    position: 'absolute',
    top: 190, 
    alignSelf: 'center',
    width: '90%',
    backgroundColor: 'rgba(30, 30, 30, 0.95)',
    padding: 15,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
    zIndex: 9
  },
  profitLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { color: 'white', fontSize: 20, fontWeight: 'bold', marginRight: 5 },
  profitInput: { color: 'white', fontSize: 24, fontWeight: 'bold', width: 100, borderBottomWidth: 1, borderBottomColor: '#555', textAlign: 'center' },
  netProfitText: { color: '#ccc', fontSize: 12, marginTop: 5 },

  button: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    width: '80%',
    height: 60,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    elevation: 20,
  },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },

  // Modal Styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { width: '80%', backgroundColor: '#222', padding: 20, borderRadius: 15, alignItems: 'center' },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSub: { color: '#888', textAlign: 'center', marginBottom: 20 },
  modalInput: { width: '100%', backgroundColor: '#333', color: 'white', padding: 15, borderRadius: 10, marginBottom: 20, textAlign: 'center', fontSize: 18 },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, alignItems: 'center', padding: 15 },
  saveBtn: { flex: 1, alignItems: 'center', padding: 15, backgroundColor: COLORS.primary, borderRadius: 10 },
});