import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { useContext, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import MapView, { Polyline } from 'react-native-maps';
import { UserContext } from '../context/UserContext';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';
import { COST_PER_MILE, IRS_RATE_PER_MILE } from '../utils/constants';

const { width, height } = Dimensions.get('window');
const BACKGROUND_TRACKING_TASK = 'background-tracking-task';

TaskManager.defineTask(BACKGROUND_TRACKING_TASK, async ({ data, error }) => {
  if (error) return;
  if (data) {
    const { locations } = data;
    try {
      const existing = await AsyncStorage.getItem('pending_locations');
      const parsed = existing ? JSON.parse(existing) : [];
      const newCoords = locations.map((l) => ({
        latitude: l.coords.latitude,
        longitude: l.coords.longitude,
        timestamp: l.timestamp,
      }));
      await AsyncStorage.setItem(
        'pending_locations',
        JSON.stringify([...parsed, ...newCoords])
      );
    } catch {}
  }
});

function deg2rad(deg) {
  return deg * (Math.PI / 180);
}

function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function mergeAndDeduplicateRoutes(fg, bg) {
  const seen = new Set(fg.map((c) => c.timestamp));
  const unique = bg.filter((c) => !seen.has(c.timestamp));
  const merged = [...fg, ...unique];
  merged.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
  return merged;
}

const checkFrequentPlaces = (coords, homeCoords) => {
  if (!coords || !homeCoords) return null;
  const dist = getDistanceFromLatLonInMiles(
    coords.latitude,
    coords.longitude,
    homeCoords.latitude,
    homeCoords.longitude
  );
  return dist < 0.2 ? 'Home Base' : null;
};

export default function TrackScreen() {
  const [location, setLocation] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(0);
  const [earnings, setEarnings] = useState(0);
  const [gigEarnings, setGigEarnings] = useState('');
  const [netProfit, setNetProfit] = useState(0);
  const [totalOdometer, setTotalOdometer] = useState(0);
  const [smartSchedule, setSmartSchedule] = useState(null);
  const [homeCoords, setHomeCoords] = useState(null);
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [manualOdometerInput, setManualOdometerInput] = useState('');

  const { isPremium } = useContext(UserContext);
  const mapRef = useRef(null);
  const subscriptionRef = useRef(null);
  const gigEarningsRef = useRef('');
  const user = auth.currentUser;

  useEffect(() => {
    gigEarningsRef.current = gigEarnings;
  }, [gigEarnings]);

  useEffect(() => {
    if (!user) return;

    getDoc(doc(db, 'users', user.uid)).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTotalOdometer(parseFloat(data.currentOdometer || 0));
        setSmartSchedule(data.schedule);
        if (data.homeLat && data.homeLon) {
          setHomeCoords({
            latitude: data.homeLat,
            longitude: data.homeLon,
          });
        }
      }
    });

    (async () => {
      const hasStarted =
        await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_TRACKING_TASK
        );
      setIsTracking(hasStarted);

      const { status } =
        await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      const current = await Location.getCurrentPositionAsync({});
      setLocation(current);
    })();

    return () => subscriptionRef.current?.remove();
  }, [user]);

  const startTrip = async () => {
    const { status } =
      await Location.requestBackgroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission Required',
        'Enable "Always Allow" location in Settings.'
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

    await Location.startLocationUpdatesAsync(
      BACKGROUND_TRACKING_TASK,
      {
        accuracy: Location.Accuracy.BestForNavigation,
        distanceInterval: 10,
      }
    );

    subscriptionRef.current =
      await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, distanceInterval: 10 },
        (newLocation) => {
          const { latitude, longitude } = newLocation.coords;

          setRouteCoordinates((prev) => {
            if (prev.length > 0) {
              const last = prev[prev.length - 1];
              const delta =
                getDistanceFromLatLonInMiles(
                  last.latitude,
                  last.longitude,
                  latitude,
                  longitude
                );

              if (delta > 0.005) {
                setDistance((d) => {
                  const newD = d + delta;
                  setEarnings(newD * IRS_RATE_PER_MILE);
                  const gross =
                    parseFloat(gigEarningsRef.current) || 0;
                  setNetProfit(gross - newD * COST_PER_MILE);
                  return newD;
                });
              }
            }
            return [
              ...prev,
              { latitude, longitude, timestamp: newLocation.timestamp },
            ];
          });
        }
      );
  };

  const stopTrip = async () => {
    setIsTracking(false);
    subscriptionRef.current?.remove();

    try {
      const bgData = await AsyncStorage.getItem(
        'pending_locations'
      );
      const bgCoords = bgData ? JSON.parse(bgData) : [];
      const finalRoute = mergeAndDeduplicateRoutes(
        routeCoordinates,
        bgCoords
      );

      let finalDist = 0;
      for (let i = 0; i < finalRoute.length - 1; i++) {
        finalDist += getDistanceFromLatLonInMiles(
          finalRoute[i].latitude,
          finalRoute[i].longitude,
          finalRoute[i + 1].latitude,
          finalRoute[i + 1].longitude
        );
      }

      let type = 'Personal';
      if (isPremium && smartSchedule?.enabled) {
        const now = new Date();
        const mins = now.getHours() * 60 + now.getMinutes();
        const [sH, sM] = smartSchedule.start.split(':').map(Number);
        const [eH, eM] = smartSchedule.end.split(':').map(Number);
        if (
          mins >= sH * 60 + sM &&
          mins <= eH * 60 + eM
        )
          type = 'Business';
      }

      const startName =
        (finalRoute.length > 0
          ? checkFrequentPlaces(finalRoute[0], homeCoords)
          : null) || 'Unknown';

      if (user) {
        await addDoc(collection(db, 'trips'), {
          userId: user.uid,
          miles: finalDist.toFixed(2),
          savings: (finalDist * IRS_RATE_PER_MILE).toFixed(2),
          type,
          grossEarnings: gigEarnings || '0',
          netProfit: (
            (parseFloat(gigEarnings || 0) -
              finalDist * COST_PER_MILE)
          ).toFixed(2),
          startLocation: startName,
          timestamp: serverTimestamp(),
          route: finalRoute,
        });
      }

      Alert.alert(
        'Trip Saved',
        `Distance: ${finalDist.toFixed(2)} mi`
      );
    } catch (e) {
      console.error(e);
    } finally {
      await AsyncStorage.removeItem(
        'pending_locations'
      ).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        showsUserLocation
      >
        <Polyline
          coordinates={routeCoordinates}
          strokeWidth={5}
          strokeColor={COLORS.primary}
        />
      </MapView>

      <TouchableOpacity
        style={[
          styles.button,
          {
            backgroundColor: isTracking
              ? COLORS.danger
              : COLORS.success,
          },
        ]}
        onPress={isTracking ? stopTrip : startTrip}
      >
        <Text style={styles.buttonText}>
          {isTracking ? 'STOP TRIP' : 'START TRACKING'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  map: { width, height },
  button: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    width: '80%',
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});