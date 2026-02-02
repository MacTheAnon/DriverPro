import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { deleteUser } from 'firebase/auth';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore'; // Added updateDoc
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext'; // Added Context import
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

const GEOFENCE_TASK = 'geofence-tracking-task';

export default function SettingsScreen({ navigation }) {
  const { user, isPremium } = useContext(UserContext); // Use Context
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Profile State
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');

  // Smart Schedule State
  const [autoTagEnabled, setAutoTagEnabled] = useState(false);
  const [workStart, setWorkStart] = useState('09:00');
  const [workEnd, setWorkEnd] = useState('17:00');

  // Geofence State
  const [isGeofenceEnabled, setIsGeofenceEnabled] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
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

  const toggleGeofence = async () => {
    if (!isGeofenceEnabled) {
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (backStatus !== 'granted') {
        Alert.alert("Permission Needed", "Geofencing requires 'Always Allow' location access in your phone settings.");
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        await Location.startGeofencingAsync(GEOFENCE_TASK, [{
          identifier: 'HOME_BASE',
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          radius: 150,
          notifyOnEnter: true,
          notifyOnExit: true,
        }]);

        setIsGeofenceEnabled(true);
        await setDoc(doc(db, "users", user.uid), { 
          geofenceActive: true,
          homeLat: location.coords.latitude,
          homeLon: location.coords.longitude
        }, { merge: true });
        Alert.alert("Home Base Set 🏠", `Tracking will pause automatically when you arrive here.\nLat: ${location.coords.latitude.toFixed(4)}`);
      } catch (e) {
        Alert.alert("Error", "Could not lock Home Base location. Try moving near a window.");
      }
    } else {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      setIsGeofenceEnabled(false);
      await setDoc(doc(db, "users", user.uid), { geofenceActive: false }, { merge: true });
      Alert.alert("Disabled", "Auto-tracking turned off.");
    }
  };

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert("Input Required", "Please enter your name.");
      return;
    }
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
      "Are you sure? This will permanently delete your data and tax records. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete Forever", 
          style: "destructive",
          onPress: async () => {
             try {
               setLoading(true);
               await deleteDoc(doc(db, "users", user.uid));
               await deleteUser(user);
             } catch (error) {
               setLoading(false);
               Alert.alert("Error", "Please re-login and try again (Security Requirement).");
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
          <Text style={styles.sectionLabel}>SMART AUTOMATION</Text>
          <View style={styles.card}>
            
            {/* Geofence Row */}
            <View style={styles.autoRow}>
              <View style={styles.iconCircle}><Ionicons name="map" size={20} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Home-Base Geofencing</Text>
                <Text style={styles.subText}>Auto-pause tracking at home.</Text>
              </View>
              <Switch 
                value={isGeofenceEnabled} 
                onValueChange={toggleGeofence}
                trackColor={{ false: "#767577", true: COLORS.primary }}
              />
            </View>

            <View style={styles.divider} />

            {/* Schedule Row */}
            <View style={styles.autoRow}>
              <View style={styles.iconCircle}><Ionicons name="time" size={20} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Work Hours Auto-Tag</Text>
                <Text style={styles.subText}>Tag trips as 'Business' during work hours.</Text>
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

        {/* SAVE BUTTON */}
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save All Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.signOut()}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Text style={styles.deleteText}>Delete Account & Data</Text>
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
  logoutBtn: { marginBottom: 20, alignItems: 'center' },
  logoutText: { color: COLORS.textSecondary, fontWeight: 'bold' },
  deleteBtn: { alignItems: 'center', marginBottom: 20 },
  deleteText: { color: COLORS.danger, fontSize: 12 }
});