import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { deleteUser } from 'firebase/auth';
import { collection, doc, getDoc, getDocs, query, setDoc, where, writeBatch } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

const BACKGROUND_TRACKING_TASK = 'background-tracking-task';
const GEOFENCE_TASK = 'geofence-tracking-task';

export default function SettingsScreen({ navigation }) {
  const { user, isPremium } = useContext(UserContext); 
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile State
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // Smart Automation State
  const [autoTrack, setAutoTrack] = useState(false);
  const [isGeofenceEnabled, setIsGeofenceEnabled] = useState(false);
  const [autoTagEnabled, setAutoTagEnabled] = useState(false);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // Home Base
  const [homeLat, setHomeLat] = useState(null);
  const [homeLon, setHomeLon] = useState(null);
  const [settingHome, setSettingHome] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        // Load Location Engine Status
        const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
        setAutoTrack(hasStarted);

        // Load DB Profile
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.displayName || '');
          setBusinessName(data.businessName || '');
          setTaxId(data.taxId || '');
          setVehicleMake(data.vehicleMake || '');
          setVehicleModel(data.vehicleModel || '');
          setVehicleYear(data.vehicleYear || '');
          
          setIsGeofenceEnabled(data.geofenceActive || false);

          if (data.homeLat) setHomeLat(data.homeLat);
          if (data.homeLon) setHomeLon(data.homeLon);

          if (data.schedule) {
            setAutoTagEnabled(data.schedule.enabled);
            setWorkStart(data.schedule.start || '09:00');
            setWorkEnd(data.schedule.end || '17:00');
          }
        }
      } catch (error) {
        console.error("Profile Load Error:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  // --- AUTOMATION TOGGLES ---
  const handleToggleAutoTrack = async (turnOn) => {
    if (!isPremium) {
      navigation.navigate('Premium');
      return;
    }
    
    setAutoTrack(turnOn);
    if (turnOn) {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      if (status === 'granted') {
        await Location.startLocationUpdatesAsync(BACKGROUND_TRACKING_TASK, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, 
          distanceInterval: 50, 
          showsBackgroundLocationIndicator: true, 
        });
        Alert.alert("Auto-Tracking Enabled", "We'll track your miles in the background.");
      } else {
        setAutoTrack(false);
        Alert.alert("Permission Needed", "Allow background location to use this feature.");
      }
    } else {
      const isRunning = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK).catch(() => false);
      if (isRunning) await Location.stopLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    }
  };

  const toggleGeofence = async (turnOn) => {
    if (!isPremium) {
      navigation.navigate('Premium');
      return;
    }

    setIsGeofenceEnabled(turnOn);
    if (turnOn) {
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backStatus !== 'granted') return setIsGeofenceEnabled(false);

      try {
        // FIX: Use already-saved home coords if available — don't silently overwrite
        // the location the user set with handleSetHomeLocation.
        let lat = homeLat;
        let lon = homeLon;

        if (!lat || !lon) {
          // No home set yet — use current position and save it
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = location.coords.latitude;
          lon = location.coords.longitude;
          await setDoc(doc(db, "users", user.uid), { geofenceActive: true, homeLat: lat, homeLon: lon }, { merge: true });
          setHomeLat(lat);
          setHomeLon(lon);
        } else {
          // Home already set — just activate geofencing at the known coords
          await setDoc(doc(db, "users", user.uid), { geofenceActive: true }, { merge: true });
        }

        await Location.startGeofencingAsync(GEOFENCE_TASK, [{
          identifier: 'HOME_BASE',
          latitude: lat,
          longitude: lon,
          radius: 150,
          notifyOnEnter: true,
          notifyOnExit: true,
        }]);
        Alert.alert("Home Base Geofencing On 🏠", "Tracking will pause automatically when you arrive home.");
      } catch (e) {
        setIsGeofenceEnabled(false);
        console.error("Geofence error:", e);
      }
    } else {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      await setDoc(doc(db, "users", user.uid), { geofenceActive: false }, { merge: true });
    }
  };

  const handleSetHomeLocation = async () => {
    if (!isPremium) {
      navigation.navigate('Premium');
      return;
    }

    Alert.alert(
      "Set Home Base 🏠",
      "This will save your current GPS location as Home Base. Make sure you're at home before confirming.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Set as Home",
          onPress: async () => {
            setSettingHome(true);
            try {
              const { status } = await Location.requestForegroundPermissionsAsync();
              if (status !== 'granted') {
                Alert.alert("Permission Needed", "Location access is required to set your home base.");
                return;
              }
              const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
              const lat = location.coords.latitude;
              const lon = location.coords.longitude;

              await setDoc(doc(db, "users", user.uid), { homeLat: lat, homeLon: lon }, { merge: true });
              setHomeLat(lat);
              setHomeLon(lon);
              Alert.alert("Home Base Saved ✅", `Location set.\n(${lat.toFixed(4)}, ${lon.toFixed(4)})`);
            } catch (e) {
              Alert.alert("Error", "Could not get your location. Please try again.");
              console.error(e);
            } finally {
              setSettingHome(false);
            }
          }
        }
      ]
    );
  };

  const handleSave = async () => {
    if (!displayName.trim()) return Alert.alert("Input Required", "Please enter your name.");
    
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName, 
        businessName, 
        taxId,
        vehicleMake,
        vehicleModel,
        vehicleYear,
        schedule: { enabled: autoTagEnabled, start: workStart, end: workEnd },
        updatedAt: new Date().toISOString()
      }, { merge: true });
      Alert.alert("Success", "Settings saved successfully.");
    } catch (e) {
      Alert.alert("Error", "Could not save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure? This will permanently delete your account, all trips, expenses, and tax records. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Forever", 
          style: "destructive",
          onPress: async () => {
            try {
              setLoading(true);

              // Step 1: Delete all trips for this user
              const tripsQuery = query(collection(db, "trips"), where("userId", "==", user.uid));
              const tripsSnap = await getDocs(tripsQuery);
              const batch = writeBatch(db);
              tripsSnap.forEach(d => batch.delete(d.ref));

              // Step 2: Delete all expenses for this user
              const expensesQuery = query(collection(db, "expenses"), where("userId", "==", user.uid));
              const expensesSnap = await getDocs(expensesQuery);
              expensesSnap.forEach(d => batch.delete(d.ref));

              // Step 3: Delete user profile doc
              batch.delete(doc(db, "users", user.uid));

              // Commit all Firestore deletes together
              await batch.commit();

              // Step 4: Delete Firebase Auth account LAST.
              // If this fails (needs re-auth), the Firestore data is already gone.
              // That's acceptable — the account is effectively dead with no data.
              // The alternative (deleting auth first) is worse: data orphaned under a deleted account.
              await deleteUser(user);

            } catch (error) {
              setLoading(false);
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  "Re-Authentication Required",
                  "For security, please sign out and sign back in, then try deleting your account again."
                );
              } else {
                Alert.alert("Error", "Could not delete account. Please try again.");
              }
            }
          }
        }
      ]
    );
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={28} color="white" />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* 1. BUSINESS IDENTITY */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BUSINESS IDENTITY</Text>
          <View style={styles.card}>
            <Text style={styles.inputLabel}>LEGAL FULL NAME</Text>
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Your Name" placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>BUSINESS NAME (LLC)</Text>
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="Business Name" placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>TAX ID (EIN/SSN)</Text>
            <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} keyboardType="numeric" placeholder="00-0000000" placeholderTextColor="#666" />
          </View>
        </View>

        {/* 2. VEHICLE INFORMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>VEHICLE DETAILS</Text>
          <View style={styles.card}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between'}}>
                <View style={{width: '48%'}}>
                    <Text style={styles.inputLabel}>MAKE</Text>
                    <TextInput style={styles.input} value={vehicleMake} onChangeText={setVehicleMake} placeholder="Ford" placeholderTextColor="#666" />
                </View>
                <View style={{width: '48%'}}>
                    <Text style={styles.inputLabel}>MODEL</Text>
                    <TextInput style={styles.input} value={vehicleModel} onChangeText={setVehicleModel} placeholder="F-150" placeholderTextColor="#666" />
                </View>
            </View>
            <Text style={styles.inputLabel}>YEAR</Text>
            <TextInput style={styles.input} value={vehicleYear} onChangeText={setVehicleYear} keyboardType="numeric" placeholder="2024" placeholderTextColor="#666" />
          </View>
        </View>

        {/* 3. SMART AUTOMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>PRO AUTOMATIONS</Text>
          <View style={styles.card}>
            
            {/* Background Tracking Row */}
            <View style={styles.autoRow}>
              <View style={[styles.iconCircle, {backgroundColor: COLORS.primary}]}><Ionicons name="infinite" size={20} color="black" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Auto-Track Miles</Text>
                <Text style={styles.subText}>Track trips in the background.</Text>
              </View>
              <Switch value={autoTrack} onValueChange={handleToggleAutoTrack} trackColor={{ false: "#767577", true: COLORS.primary }} />
            </View>

            <View style={styles.divider} />

            {/* Geofence Row */}
            <View style={styles.autoRow}>
              <View style={styles.iconCircle}><Ionicons name="map" size={20} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Home-Base Geofencing</Text>
                <Text style={styles.subText}>Auto-pause tracking at home.</Text>
              </View>
              <Switch value={isGeofenceEnabled} onValueChange={toggleGeofence} trackColor={{ false: "#767577", true: COLORS.primary }} />
            </View>

            {/* Set Home Location Button */}
            <TouchableOpacity
              style={[styles.homeBtn, settingHome && { opacity: 0.6 }]}
              onPress={handleSetHomeLocation}
              disabled={settingHome}
            >
              <Ionicons name="home" size={16} color={homeLat ? COLORS.success : COLORS.textSecondary} style={{ marginRight: 8 }} />
              {settingHome ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Text style={[styles.homeBtnText, homeLat && { color: COLORS.success }]}>
                  {homeLat ? `Home Set  (${homeLat.toFixed(3)}, ${homeLon.toFixed(3)})` : 'Tap to Set Home Location'}
                </Text>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Schedule Row */}
            <View style={styles.autoRow}>
              <View style={styles.iconCircle}><Ionicons name="time" size={20} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Work Hours Auto-Tag</Text>
                <Text style={styles.subText}>Tag trips as 'Business' during work.</Text>
              </View>
              <Switch 
                value={autoTagEnabled} 
                onValueChange={(val) => {
                    if (!isPremium && val) navigation.navigate('Premium');
                    else setAutoTagEnabled(val);
                }}
                trackColor={{ false: "#767577", true: COLORS.primary }}
              />
            </View>

            {autoTagEnabled && (
                <View style={{marginTop: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                    <TextInput style={styles.timeInput} value={workStart} onChangeText={setWorkStart} placeholder="09:00" placeholderTextColor="#666" />
                    <Text style={{color:'white', marginHorizontal: 10}}>TO</Text>
                    <TextInput style={styles.timeInput} value={workEnd} onChangeText={setWorkEnd} placeholder="17:00" placeholderTextColor="#666" />
                </View>
            )}

          </View>
        </View>

        {/* ACCOUNT BUTTONS */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save All Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, {backgroundColor: '#333', marginTop: -15}]} onPress={() => navigation.navigate('Premium')}>
            <Text style={styles.saveText}>{isPremium ? "Manage Premium Subscription" : "Upgrade to DriverPro+"}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.signOut()}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Ionicons name="trash-outline" size={16} color={COLORS.danger} style={{ marginRight: 6 }} />
          <Text style={styles.deleteText}>Delete Account & All Data</Text>
        </TouchableOpacity>
        
        <View style={{height: 40}} /> 
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 30 },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginLeft: 15 },
  section: { marginBottom: 35 },
  sectionLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 15, letterSpacing: 1.5 },
  card: { backgroundColor: COLORS.card, borderRadius: 15, padding: 20, borderWidth: 1, borderColor: '#333' },
  inputLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold', marginBottom: 8 },
  input: { backgroundColor: '#252525', color: 'white', padding: 15, borderRadius: 12, fontSize: 16, marginBottom: 20 },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 30 },
  saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  autoRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 5 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  rowText: { flex: 1, color: 'white', fontSize: 15, fontWeight: 'bold' },
  subText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  timeInput: { backgroundColor: '#252525', color: 'white', padding: 10, borderRadius: 8, width: 80, textAlign: 'center', fontWeight: 'bold' },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  homeBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 12, backgroundColor: '#252525', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  homeBtnText: { color: COLORS.textSecondary, fontSize: 13, fontWeight: '600' },
  logoutBtn: { marginBottom: 20, alignItems: 'center' },
  logoutText: { color: COLORS.textSecondary, fontWeight: 'bold', fontSize: 16 },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 20, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.danger, borderRadius: 10 },
  deleteText: { color: COLORS.danger, fontSize: 15, fontWeight: '600' }
});