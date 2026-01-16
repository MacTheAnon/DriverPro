import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({ milesToday: 0, taxSavings: 0, driveTime: 'Active' });
  const [monthlyGoal, setMonthlyGoal] = useState(500); 
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('500');
  
  // State for dynamic user data
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // 1. Listen for Trip Stats (Miles & Savings)
    const qTrips = query(collection(db, "trips"), where("userId", "==", user.uid));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
      let totalM = 0; let totalS = 0;
      snapshot.forEach((doc) => {
        totalM += parseFloat(doc.data().miles || 0);
        totalS += parseFloat(doc.data().savings || 0);
      });
      setStats({ 
        milesToday: totalM.toFixed(1), 
        taxSavings: totalS.toFixed(2), 
        driveTime: 'Active' 
      });
    });

    // 2. Listen for User Profile & Onboarding Logic
    const unsubSettings = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // PRODUCTION ONBOARDING CHECK:
        // If the user has no name set, they shouldn't be here. Send them to Settings.
        if (!data.displayName || data.displayName.trim() === "") {
          Alert.alert(
            "Profile Required", 
            "Please enter your name to personalize your business dashboard.",
            [{ text: "Go to Settings", onPress: () => navigation.replace('Settings') }]
          );
          return;
        }

        setDisplayName(data.displayName);
        setBusinessName(data.businessName || 'Independent Contractor');
        
        if (data.monthlyGoal) {
          setMonthlyGoal(data.monthlyGoal);
          setTempGoal(data.monthlyGoal.toString());
        }
      } else {
        // If the user document doesn't exist at all, force setup
        navigation.replace('Settings');
      }
    });

    return () => { unsubTrips(); unsubSettings(); };
  }, [user]);

  const saveGoal = async () => {
    const newGoal = parseFloat(tempGoal);
    if (!isNaN(newGoal) && newGoal > 0) {
      try {
        await setDoc(doc(db, "users", user.uid), { 
          monthlyGoal: newGoal,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        setIsEditingGoal(false);
      } catch (error) {
        Alert.alert("Error", "Could not save goal to cloud.");
      }
    } else {
      Alert.alert("Invalid Input", "Please enter a valid number.");
    }
  };

  const handleSettings = () => {
    navigation.navigate('Settings');
  };

  const progress = Math.min((parseFloat(stats.taxSavings) / monthlyGoal) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{displayName || "New User"}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={handleSettings}>
           <Ionicons name="settings-outline" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        
        {/* STATUS CARD */}
        <View style={styles.statusCard}>
          <View style={styles.statusRow}>
             <View style={styles.indicator} />
             <Text style={styles.statusText}>Tracking Active</Text>
          </View>
          <Text style={styles.statusSubtext}>Monitoring {businessName}.</Text>
        </View>

        {/* MONTHLY GOAL SECTION */}
        <View style={styles.goalSection}>
          <View style={styles.goalHeader}>
            <Text style={styles.sectionTitle}>Monthly Goal</Text>
            {!isEditingGoal ? (
              <TouchableOpacity onPress={() => setIsEditingGoal(true)} style={styles.editRow}>
                <Text style={styles.goalPercent}>{progress.toFixed(0)}%</Text>
                <Ionicons name="pencil" size={14} color={COLORS.primary} style={{marginLeft: 5}} />
              </TouchableOpacity>
            ) : (
              <View style={styles.editInputRow}>
                <TextInput
                  style={styles.goalInput}
                  keyboardType="numeric"
                  value={tempGoal}
                  onChangeText={setTempGoal}
                  autoFocus
                  selectTextOnFocus
                />
                <TouchableOpacity onPress={saveGoal}>
                  <Ionicons name="checkmark-circle" size={28} color={COLORS.success} />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.goalSubtext}>
            ${stats.taxSavings} saved of your ${monthlyGoal} target
          </Text>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Deduction</Text>
            <Text style={styles.statValue}>${stats.taxSavings}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Miles</Text>
            <Text style={styles.statValue}>{stats.milesToday}</Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: COLORS.success }]} 
            onPress={() => navigation.navigate('Track')}
          >
            <Ionicons name="play" size={24} color="white" />
            <Text style={styles.actionText}>Start Trip</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: COLORS.primary }]} 
            onPress={() => navigation.navigate('Wallet')}
          >
            <Ionicons name="wallet" size={24} color="white" />
            <Text style={styles.actionText}>Wallet</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  greeting: { color: COLORS.textSecondary, fontSize: 14 },
  username: { color: COLORS.text, fontSize: 26, fontWeight: 'bold' },
  profileBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.card, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  statusCard: { backgroundColor: '#1A2F4B', padding: 20, borderRadius: 15, marginBottom: 25, borderWidth: 1, borderColor: COLORS.primary },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  indicator: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.success, marginRight: 10 },
  statusText: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  statusSubtext: { color: COLORS.textSecondary, fontSize: 14 },
  goalSection: { marginBottom: 30 },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, height: 40 },
  editRow: { flexDirection: 'row', alignItems: 'center' },
  editInputRow: { flexDirection: 'row', alignItems: 'center' },
  goalInput: { backgroundColor: '#333', color: 'white', paddingHorizontal: 10, borderRadius: 8, height: 35, width: 80, marginRight: 10, fontSize: 16 },
  goalPercent: { color: COLORS.primary, fontWeight: 'bold', fontSize: 18 },
  progressBarBg: { height: 12, backgroundColor: '#333', borderRadius: 6, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: COLORS.primary, borderRadius: 6 },
  goalSubtext: { color: COLORS.textSecondary, fontSize: 12, marginTop: 8 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statBox: { width: '48%', backgroundColor: COLORS.card, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 5 },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: 'bold' },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { width: '48%', flexDirection: 'row', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: 'white', fontWeight: 'bold', marginLeft: 10 }
});