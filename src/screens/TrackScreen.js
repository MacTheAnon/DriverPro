import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { addDoc, collection, doc, getDoc, increment, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { useContext, useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, InputAccessoryView, Keyboard, Modal, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { UserContext } from '../context/UserContext';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';
import { COST_PER_MILE, IRS_RATE_PER_MILE } from '../utils/constants'; // FIX: shared constant — update once, syncs everywhere

const { width, height } = Dimensions.get('window');
const BACKGROUND_TRACKING_TASK = 'background-tracking-task';
const KEYBOARD_ACCESSORY_ID = 'gigEarningsAccessory';

// FIX: Module-level variable so the foreground subscription survives tab switches.
// Storing it in useRef causes useEffect cleanup to kill it on unmount (tab switch),
// freezing trip miles at 0 when the user navigates back to this tab.
let foregroundSubscription = null;

// --- 1. BACKGROUND TASK DEFINITION ---
// Must stay outside the component to work when the app is backgrounded
TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error('Background Location Error:', error);
    return;
  }
  if (data) {
    const { locations } = data;
    try {
      const existing = await AsyncStorage.getItem('pending_locations');
      const parsed = existing ? JSON.parse(existing) : [];
      const newCoords = locations.map(l => ({
        latitude: l.coords.latitude,
        longitude: l.coords.longitude,
        timestamp: l.timestamp,
      }));
      await AsyncStorage.setItem('pending_locations', JSON.stringify([...parsed, ...newCoords]));
    } catch (e) {
      console.error('AsyncStorage Sync Error:', e);
    }
  }
});

// --- HELPERS ---
function deg2rad(deg) { return deg * (Math.PI / 180); }

function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// FIX #3: Deduplicate background + foreground coords by timestamp
function mergeAndDeduplicateRoutes(foreground, background) {
  const seen = new Set(foreground.map(c => c.timestamp));
  const unique = background.filter(c => !seen.has(c.timestamp));
  const merged = [...foreground, ...unique];
  merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return merged;
}

// FIX #5: Accept coords + userHomeCoords so home isn't hardcoded
const checkFrequentPlaces = (coords, homeCoords) => {
  if (!coords || !homeCoords) return null;
  const dist = getDistanceFromLatLonInMiles(
    coords.latitude, coords.longitude,
    homeCoords.latitude, homeCoords.longitude
  );
  return dist < 0.2 ? 'Home Base' : null;
};

export default function TrackScreen({ navigation }) {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);

  const [distance, setDistance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [gigEarnings, setGigEarnings] = useState('');
  const [netProfit, setNetProfit] = useState(0);

  const [totalOdometer, setTotalOdometer] = useState(0);
  const [smartSchedule, setSmartSchedule] = useState(null);
  // FIX #5: Store home coords from Firestore instead of hardcoding
  const [homeCoords, setHomeCoords] = useState(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [manualOdometerInput, setManualOdometerInput] = useState('');

  const { isPremium } = useContext(UserContext);
  const mapRef = useRef(null);
  // FIX: subscriptionRef removed — using module-level foregroundSubscription instead
  const gigEarningsRef = useRef('');
  const user = auth.currentUser;

  // Keep ref in sync with state
  useEffect(() => {
    gigEarningsRef.current = gigEarnings;
  }, [gigEarnings]);

  // Load Initial Data
  useEffect(() => {
    if (user) {
      getDoc(doc(db, 'users', user.uid)).then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setTotalOdometer(parseFloat(data.currentOdometer || 0));
          setSmartSchedule(data.schedule);
          // FIX #5: Load home coords — field names match SettingsScreen writes (homeLat/homeLon)
          if (data.homeLat && data.homeLon) {
            setHomeCoords({ latitude: data.homeLat, longitude: data.homeLon });
          }
        } else {
          // FIX #7: Initialize user doc with defaults on first use
          setDoc(doc(db, 'users', user.uid), { currentOdometer: 0, totalTrackedMiles: 0 }, { merge: true });
        }
      });
    }

    (async () => {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      setIsTracking(hasStarted);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
    })();

    return () => {
      // FIX: intentionally not removing foregroundSubscription here.
      // It's module-level so it must survive tab switches (unmount/remount).
      // It is only torn down explicitly in stopTrip().
    };
  }, [user]);

  const handleSetOdometer = async () => {
    const val = parseFloat(manualOdometerInput);
    if (isNaN(val) || val < 0) return Alert.alert('Invalid Input', 'Please enter a valid number.');
    setTotalOdometer(val);
    setShowOdometerModal(false);
    if (user) {
      await setDoc(doc(db, 'users', user.uid), { currentOdometer: val }, { merge: true });
      Alert.alert('Success', 'Odometer updated.');
    }
  };

  // FIX #1: Wrap handler in useCallback and read gigEarningsRef.current inside the watcher
  const startTrip = async () => {
    try {
      const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus !== 'granted') {
        Alert.alert(
          'Always Allow Required',
          "Please go to Settings > Location and select 'Always Allow' so we can track your miles while your phone is locked."
        );
        return;
      }

      setIsTracking(true);
      setRouteCoordinates([]);
      setDistance(0);
      setEarnings(0);
      setGigEarnings('');
      gigEarningsRef.current = '';
      setNetProfit(0);

      await AsyncStorage.removeItem('pending_locations');

      // Start Background Engine
      await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
        deferredUpdatesInterval: 5000,
        foregroundService: {
          notificationTitle: 'DriverPro Tracking',
          notificationBody: 'Mileage tracking is active...',
          notificationColor: COLORS.primary,
        },
      });

      // Start Foreground Watcher for Map Display
      foregroundSubscription = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;
          setLocation(newLocation);

          setRouteCoordinates((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const delta = getDistanceFromLatLonInMiles(last.latitude, last.longitude, latitude, longitude);

              // Filter GPS jitter (~26 feet)
              if (delta > 0.005) {
                setDistance((d) => {
                  const newD = d + delta;
                  setEarnings(newD * IRS_RATE_PER_MILE);
                  // FIX #1: Read current gig earnings from ref, not stale closure
                  const gross = parseFloat(gigEarningsRef.current) || 0;
                  setNetProfit(gross - newD * COST_PER_MILE);
                  return newD;
                });
              }
            }
            return [...prev, { latitude, longitude, timestamp: newLocation.timestamp }];
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
      console.error(error);
      setIsTracking(false);
    }
  };

  const stopTrip = async () => {
    setIsTracking(false);
    foregroundSubscription?.remove();
    foregroundSubscription = null;

    try {
      const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
      if (hasStarted) await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);

      // FIX #3: Deduplicate foreground + background routes by timestamp
      const bgData = await AsyncStorage.getItem('pending_locations');
      const bgCoords = bgData ? JSON.parse(bgData) : [];
      const finalRoute = mergeAndDeduplicateRoutes(routeCoordinates, bgCoords);

      // Final distance calculation over deduplicated, sorted route
      let finalDist = 0;
      for (let i = 0; i < finalRoute.length - 1; i++) {
        finalDist += getDistanceFromLatLonInMiles(
          finalRoute[i].latitude, finalRoute[i].longitude,
          finalRoute[i + 1].latitude, finalRoute[i + 1].longitude
        );
      }

      // Smart Schedule Classification
      let type = 'Personal';
      if (isPremium && smartSchedule?.enabled) {
        const now = new Date();
        const currentMins = now.getHours() * 60 + now.getMinutes();
        const [sH, sM] = smartSchedule.start.split(':').map(Number);
        const [eH, eM] = smartSchedule.end.split(':').map(Number);
        if (currentMins >= sH * 60 + sM && currentMins <= eH * 60 + eM) type = 'Business';
      }

      // FIX #5: Pass homeCoords from state instead of hardcoded values
      const startName = (finalRoute.length > 0 ? checkFrequentPlaces(finalRoute[0], homeCoords) : null) || 'Unknown';

      if (user) {
        await addDoc(collection(db, 'trips'), {
          userId: user.uid,
          miles: finalDist.toFixed(2),
          savings: (finalDist * IRS_RATE_PER_MILE).toFixed(2),
          type,
          grossEarnings: gigEarnings || '0',
          netProfit: (parseFloat(gigEarnings || 0) - finalDist * COST_PER_MILE).toFixed(2),
          startLocation: startName,
          timestamp: serverTimestamp(),
          route: finalRoute,
        });

        const newOdometer = totalOdometer + finalDist;
        await updateDoc(doc(db, 'users', user.uid), {
          currentOdometer: newOdometer,
          totalTrackedMiles: increment(finalDist),
        });

        checkMaintenance(newOdometer, finalDist);
        setTotalOdometer(newOdometer);
      }

      Alert.alert('Trip Saved', `Logged as ${type}.\nTotal Distance: ${finalDist.toFixed(2)} mi`);
    } catch (error) {
      console.error(error);
    } finally {
      // FIX #6: Always clean up pending locations, even if an error occurred
      await AsyncStorage.removeItem('pending_locations').catch(() => {});
    }
  };

  const checkMaintenance = (odometer, tripDist) => {
    if (Math.floor(odometer / 6000) > Math.floor((odometer - tripDist) / 6000)) {
      Alert.alert('Maintenance 🔧', 'Time for a Tire Rotation (6,000 mi interval)!');
    }
    if (Math.floor(odometer / 50000) > Math.floor((odometer - tripDist) / 50000)) {
      Alert.alert('Major Service ⚠️', '50,000 mile check: Inspect Brakes and Tires.');
    }
  };

  return (
    <View style={styles.container}>
      {location ? (
        <MapView
          ref={mapRef}
          style={styles.map}
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

      {/* STATS CARD */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TRIP MILES</Text>
          <Text style={styles.statValue}>
            {distance.toFixed(2)} <Text style={styles.unit}>mi</Text>
          </Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>TAX SAVINGS</Text>
          <Text style={[styles.statValue, { color: COLORS.success }]}>${earnings.toFixed(2)}</Text>
        </View>
      </View>

      {/* ODOMETER BAR (Clickable) */}
      <TouchableOpacity style={styles.odometerContainer} onPress={() => setShowOdometerModal(true)}>
        <Ionicons name="speedometer-outline" size={16} color="#888" style={{ marginRight: 8 }} />
        <Text style={styles.odometerText}>
          Odometer:{' '}
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            {totalOdometer.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi
          </Text>
        </Text>
        <Ionicons name="pencil" size={12} color="#888" style={{ marginLeft: 8 }} />
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
              // iOS: link this input to the accessory toolbar below via matching ID
              inputAccessoryViewID={Platform.OS === 'ios' ? KEYBOARD_ACCESSORY_ID : undefined}
              // Android: numeric keyboard does have a done key, so returnKeyType works there
              returnKeyType={Platform.OS === 'android' ? 'done' : undefined}
              blurOnSubmit={true}
              value={gigEarnings}
              onChangeText={(text) => {
                const cleaned = text.replace(/[^0-9.]/g, '');
                setGigEarnings(cleaned);
                gigEarningsRef.current = cleaned;
                const gross = parseFloat(cleaned) || 0;
                setNetProfit(gross - distance * COST_PER_MILE);
              }}
              onSubmitEditing={Keyboard.dismiss}
            />
          </View>
          <Text style={styles.netProfitText}>
            Real Profit:{' '}
            <Text style={{ color: netProfit >= 0 ? COLORS.success : COLORS.danger }}>
              ${netProfit.toFixed(2)}
            </Text>
          </Text>
        </View>
      )}

      {/* iOS keyboard toolbar — renders above the number pad with a Done button */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardToolbar}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={styles.keyboardDoneBtn}>
              <Text style={styles.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      {/* START/STOP BUTTON */}
      <TouchableOpacity
        style={[styles.button, { backgroundColor: isTracking ? COLORS.danger : COLORS.success }]}
        onPress={isTracking ? stopTrip : startTrip}
      >
        <Ionicons
          name={isTracking ? 'stop' : 'play'}
          size={24}
          color="white"
          style={{ marginRight: 10 }}
        />
        <Text style={styles.buttonText}>{isTracking ? 'STOP TRIP' : 'START TRACKING'}</Text>
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
                <Text style={{ color: '#aaa' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSetOdometer} style={styles.saveBtn}>
                <Text style={{ color: 'white', fontWeight: 'bold' }}>Save</Text>
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
  map: { width, height },
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
    borderColor: '#333',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  statValue: { color: 'white', fontSize: 24, fontWeight: 'bold', marginTop: 5 },
  unit: { fontSize: 14, color: '#888' },
  divider: { width: 1, backgroundColor: '#333', marginHorizontal: 10 },

  odometerContainer: {
    position: 'absolute',
    top: 145,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  odometerText: { color: '#ccc', fontSize: 12 },

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
    zIndex: 9,
  },
  profitLabel: { color: '#888', fontSize: 10, fontWeight: 'bold', marginBottom: 5 },
  inputRow: { flexDirection: 'row', alignItems: 'center' },
  dollarSign: { color: 'white', fontSize: 20, fontWeight: 'bold', marginRight: 5 },
  profitInput: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    width: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#555',
    textAlign: 'center',
  },
  netProfitText: { color: '#ccc', fontSize: 12, marginTop: 5 },

  button: {
    position: 'absolute',
    bottom: 85, // FIX: was 50 — tab bar is 65px tall so button was hidden behind it
    alignSelf: 'center',
    width: '85%',
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

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    backgroundColor: '#222',
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
  },
  modalTitle: { color: 'white', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  modalSub: { color: '#888', textAlign: 'center', marginBottom: 20 },
  modalInput: {
    width: '100%',
    backgroundColor: '#333',
    color: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 20,
    textAlign: 'center',
    fontSize: 18,
  },
  modalButtons: { flexDirection: 'row', width: '100%', justifyContent: 'space-between' },
  cancelBtn: { flex: 1, alignItems: 'center', padding: 15 },
  saveBtn: {
    flex: 1,
    alignItems: 'center',
    padding: 15,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
  },

  // iOS keyboard Done toolbar
  keyboardToolbar: {
    backgroundColor: '#1C1C1E',
    borderTopWidth: 1,
    borderTopColor: '#333',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  keyboardDoneBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  keyboardDoneText: {
    color: COLORS.primary,
    fontSize: 17,
    fontWeight: '600',
  },
});