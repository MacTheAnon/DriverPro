import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

const GEOFENCE_TASK = 'geofence-tracking-task';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [isGeofenceEnabled, setIsGeofenceEnabled] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setDisplayName(data.displayName || '');
          setBusinessName(data.businessName || '');
          setTaxId(data.taxId || '');
          setIsGeofenceEnabled(data.geofenceActive || false);
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
      const { status: foreStatus } = await Location.requestForegroundPermissionsAsync();
      const { status: backStatus } = await Location.requestBackgroundPermissionsAsync();
      
      if (foreStatus !== 'granted' || backStatus !== 'granted') {
        Alert.alert("Permission Needed", "Geofencing requires 'Always Allow' location access.");
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
        await setDoc(doc(db, "users", user.uid), { geofenceActive: true }, { merge: true });
        Alert.alert("Home Base Set", "DriverPro will auto-track when you exit this area.");
      } catch (e) {
        Alert.alert("Error", "Could not lock Home Base location.");
      }
    } else {
      await Location.stopGeofencingAsync(GEOFENCE_TASK);
      setIsGeofenceEnabled(false);
      await setDoc(doc(db, "users", user.uid), { geofenceActive: false }, { merge: true });
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
        displayName, businessName, taxId, updatedAt: new Date().toISOString()
      }, { merge: true });
      Alert.alert("Success", "Profile synced to cloud.");
    } catch (e) {
      Alert.alert("Error", "Could not save profile.");
    } finally {
      setSaving(false);
    }
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
            <TextInput style={styles.input} value={displayName} onChangeText={setDisplayName} placeholder="Kaleb McIntosh" placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>BUSINESS NAME (LLC)</Text>
            <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="McIntosh Digital Solutions" placeholderTextColor="#666" />
            <Text style={styles.inputLabel}>TAX ID (EIN/SSN)</Text>
            <TextInput style={styles.input} value={taxId} onChangeText={setTaxId} keyboardType="numeric" placeholder="00-0000000" placeholderTextColor="#666" />
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="white" /> : <Text style={styles.saveText}>Save Identity</Text>}
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. SMART AUTOMATION */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>SMART AUTOMATION</Text>
          <View style={styles.card}>
            <View style={styles.autoRow}>
              <View style={styles.iconCircle}><Ionicons name="map" size={20} color="white" /></View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.rowText}>Home-Base Geofencing</Text>
                <Text style={styles.subText}>Auto-track trips when leaving home/office.</Text>
              </View>
              <TouchableOpacity onPress={toggleGeofence}>
                <Ionicons name={isGeofenceEnabled ? "toggle" : "toggle-outline"} size={42} color={isGeofenceEnabled ? COLORS.success : "#444"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 3. LEARNING CENTER */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEARNING CENTER</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => Alert.alert("Tutorial", "Loading...")}>
              <Ionicons name="play-circle" size={24} color={COLORS.primary} />
              <Text style={[styles.rowText, {marginLeft: 15}]}>Tax Deduction Mastery</Text>
              <Ionicons name="chevron-forward" size={18} color="#444" />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => Alert.alert("Safety", "Opening Safety Guide...")}>
              <Ionicons name="shield-checkmark" size={24} color={COLORS.success} />
              <Text style={[styles.rowText, {marginLeft: 15}]}>Driver Safety Protocol</Text>
              <Ionicons name="chevron-forward" size={18} color="#444" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 4. FOUNDER'S NOTE */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FROM THE FOUNDER</Text>
          <View style={[styles.card, { backgroundColor: '#1A2F4B', borderColor: COLORS.primary }]}>
            <Text style={styles.founderTitle}>The DriverPro Mission</Text>
            <Text style={styles.founderText}>
              "I built DriverPro to give independent professionals the protection and profit tracking we deserve. Whether you're in the shop or on the road, our goal is to keep your business compliant and your data secure."
            </Text>
            <Text style={styles.founderSign}>— Kaleb McIntosh</Text>
            <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL('mailto:support@driverpro.com')}>
              <Text style={styles.contactBtnText}>Contact Support</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 5. LEGAL & PRIVACY */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>LEGAL & PRIVACY</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourwebsite.com/privacy')}>
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.rowText, {marginLeft: 15}]}>Privacy Policy</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => Linking.openURL('https://yourwebsite.com/terms')}>
              <Ionicons name="document-text-outline" size={20} color={COLORS.textSecondary} />
              <Text style={[styles.rowText, {marginLeft: 15}]}>Terms of Service</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.versionText}>DriverPro v1.0.0 | McIntosh Digital Solutions</Text>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => auth.signOut()}>
          <Text style={styles.logoutText}>Sign Out of DriverPro</Text>
        </TouchableOpacity>
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
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center' },
  saveText: { color: 'white', fontWeight: 'bold' },
  autoRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1, color: 'white', fontSize: 15, fontWeight: 'bold' },
  subText: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  founderTitle: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 10 },
  founderText: { color: '#BDC3C7', fontSize: 14, lineHeight: 20, fontStyle: 'italic' },
  founderSign: { color: COLORS.primary, fontWeight: 'bold', marginTop: 15, fontSize: 13 },
  contactBtn: { marginTop: 20, backgroundColor: 'rgba(255,255,255,0.1)', padding: 10, borderRadius: 8, alignItems: 'center' },
  contactBtnText: { color: 'white', fontSize: 12, fontWeight: 'bold' },
  versionText: { color: '#555', fontSize: 10, textAlign: 'center', marginTop: 15 },
  logoutBtn: { marginBottom: 40, alignItems: 'center' },
  logoutText: { color: COLORS.danger, fontWeight: 'bold' }
});