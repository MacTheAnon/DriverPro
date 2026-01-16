import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import LottieView from 'lottie-react-native'; // Standard for pro apps
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function SettingsScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [profile, setProfile] = useState({ displayName: '', businessName: '' });

  const user = auth.currentUser;
  const canGoBack = navigation.canGoBack();

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          setProfile({
            displayName: docSnap.data().displayName || '',
            businessName: docSnap.data().businessName || '',
          });
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!profile.displayName.trim()) {
      Alert.alert("Input Required", "Please enter your name to personalize your dashboard.");
      return;
    }
    
    setSaving(true);
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: profile.displayName.trim(),
        businessName: profile.businessName.trim() || 'Independent Contractor',
      }, { merge: true });

      // TRIGGER SUCCESS ANIMATION
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        if (!canGoBack) navigation.replace('Dashboard');
      }, 2000);

    } catch (error) {
      Alert.alert("Error", "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: async () => {
          try { await signOut(auth); navigation.replace('Login'); } 
          catch (e) { Alert.alert("Error", "Failed to sign out."); }
      }}
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        {/* Only show back button if they have a name set (Force Onboarding) */}
        {canGoBack && profile.displayName ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        ) : <View style={{ width: 24 }} />}
        
        <Text style={styles.headerTitle}>Account Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.form} showsVerticalScrollIndicator={false}>
        <Text style={styles.label}>Full Name</Text>
        <TextInput
          style={styles.input}
          value={profile.displayName}
          onChangeText={(txt) => setProfile({ ...profile, displayName: txt })}
          placeholder="Enter your name"
          placeholderTextColor="#666"
        />

        <Text style={styles.label}>Business Name</Text>
        <TextInput
          style={styles.input}
          value={profile.businessName}
          onChangeText={(txt) => setProfile({ ...profile, businessName: txt })}
          placeholder="e.g. Your Company LLC"
          placeholderTextColor="#666"
        />

        <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Save Changes</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={[styles.saveBtn, { backgroundColor: COLORS.danger, marginTop: 20 }]} onPress={handleSignOut}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* SUCCESS OVERLAY */}
      {showSuccess && (
        <View style={styles.successOverlay}>
          <LottieView
            source={require('../assets/animations/success.json')}
            autoPlay
            loop={false}
            style={{ width: 200, height: 200 }}
          />
          <Text style={styles.successText}>Profile Updated!</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  centered: { flex: 1, backgroundColor: COLORS.background, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 },
  headerTitle: { color: 'white', fontSize: 20, fontWeight: 'bold' },
  form: { marginTop: 10 },
  label: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 8, fontWeight: '600' },
  input: { backgroundColor: COLORS.card, color: 'white', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  successOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(18,18,18,0.9)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  successText: { color: 'white', fontSize: 20, fontWeight: 'bold', marginTop: 10 }
});