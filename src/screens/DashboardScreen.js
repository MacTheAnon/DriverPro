import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location'; // ADDED: To check real tracking status
import { StatusBar } from 'expo-status-bar';
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'; // ADDED: RefreshControl
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

const BACKGROUND_TRACKING_TASK = 'background-tracking-task'; // Must match App.js

export default function DashboardScreen({ navigation }) {
  const [stats, setStats] = useState({ milesToday: '0.0', taxSavings: '0.00', totalDeduction: '0.00' });
  const [isTrackingActive, setIsTrackingActive] = useState(false); // ADDED: Real status
  const [totalExpenses, setTotalExpenses] = useState(0); // ADDED: To hold expense total
  const [monthlyGoal, setMonthlyGoal] = useState(500); 
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [tempGoal, setTempGoal] = useState('500');
  
  const [displayName, setDisplayName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const user = auth.currentUser;

  // 1. Check Tracking Status (On Focus/Load)
  const checkTrackingStatus = async () => {
    const hasStarted = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TRACKING_TASK);
    setIsTrackingActive(hasStarted);
  };

  useEffect(() => {
    const unsubscribeFocus = navigation.addListener('focus', () => {
      checkTrackingStatus();
    });
    return unsubscribeFocus;
  }, [navigation]);

  useEffect(() => {
    if (!user) return;

    // 2. Real-time Trip Data (Fixed Logic)
    const qTrips = query(collection(db, "trips"), where("userId", "==", user.uid));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
      let todayM = 0; 
      let totalS = 0;
      
      // Get Start of Today (00:00:00)
      const startOfDay = new Date();
      startOfDay.setHours(0,0,0,0);

      snapshot.forEach((doc) => {
        const data = doc.data();
        const miles = parseFloat(data.miles || 0);
        const savings = parseFloat(data.savings || 0);

        // Accumulate Lifetime Savings
        totalS += savings;

        // Accumulate ONLY Today's Miles
        if (data.timestamp?.toDate() >= startOfDay) {
          todayM += miles;
        }
      });

      setStats({ 
        milesToday: todayM.toFixed(1), 
        taxSavings: totalS.toFixed(2), // Total Lifetime Deduction
        // UPDATED: Combine savings and expenses for a true total deduction
        totalDeduction: (totalS + totalExpenses).toFixed(2)
      });
    });

    // 3. Real-time Expense Data (for accurate total deduction)
    const qExpenses = query(collection(db, "expenses"), where("userId", "==", user.uid));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      let expAcc = 0;
      snapshot.forEach((doc) => {
        const data = doc.data();
        expAcc += parseFloat(data.amount || 0);
      });
      setTotalExpenses(expAcc);
    });

    // 4. Real-time Profile & Goal Data
    const unsubSettings = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setDisplayName(data.displayName);
        setBusinessName(data.businessName || 'Independent Contractor');
        if (data.monthlyGoal) {
          setMonthlyGoal(data.monthlyGoal);
          setTempGoal(data.monthlyGoal.toString());
        }
      }
    });

    checkTrackingStatus();

    return () => { unsubTrips(); unsubSettings(); unsubExpenses(); };
  }, [user, totalExpenses]); // Rerun when expenses change to update total

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await checkTrackingStatus();
    // Simulate a quick reload for UX
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

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

  const progress = Math.min((parseFloat(stats.totalDeduction) / monthlyGoal) * 100, 100);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{displayName || "Driver"}</Text>
        </View>
        <TouchableOpacity style={styles.profileBtn} onPress={() => navigation.navigate('Settings')}>
           <Ionicons name="settings-outline" size={20} color="#FFF" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        
        {/* STATUS CARD (Dynamic) */}
        <View style={[styles.statusCard, { borderColor: isTrackingActive ? COLORS.success : '#333' }]}>
          <View style={styles.statusRow}>
             <View style={[styles.indicator, { backgroundColor: isTrackingActive ? COLORS.success : COLORS.textSecondary }]} />
             <Text style={styles.statusText}>{isTrackingActive ? "Tracking Active" : "Tracking Paused"}</Text>
          </View>
          <Text style={styles.statusSubtext}>
            {isTrackingActive ? `Monitoring ${businessName}.` : "Tap 'Start Trip' to log miles."}
          </Text>
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
            ${stats.totalDeduction} saved of your ${monthlyGoal} target
          </Text>
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Total Deduction</Text>
            <Text style={styles.statValue}>${stats.totalDeduction}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Miles Today</Text>
            <Text style={styles.statValue}>{stats.milesToday}</Text>
          </View>
        </View>

        {/* QUICK ACTIONS */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionRow}>
          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: COLORS.card}]} onPress={() => navigation.navigate('Track')}>
            <Ionicons name={isTrackingActive ? "stop-circle" : "play-circle"} size={32} color={isTrackingActive ? COLORS.danger : "white"} />
            <Text style={styles.actionText}>{isTrackingActive ? "Stop Trip" : "Start Trip"}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionBtn, {backgroundColor: COLORS.card}]} onPress={() => navigation.navigate('Wallet')}>
            <Ionicons name="receipt" size={32} color="white" />
            <Text style={styles.actionText}>View Wallet</Text>
          </TouchableOpacity>
        </View>

        {/* PASSENGER / SAFETY (Placeholder for Demo) */}
        <View style={{marginTop: 30}}>
          <Text style={styles.sectionTitle}>Safety Tools</Text>
          <View style={styles.passengerCard}>
            <View style={styles.passengerInfo}>
              <View style={styles.avatarCircle}>
                <Ionicons name="shield-checkmark" size={24} color="white" />
              </View>
              <View>
                <Text style={styles.passengerName}>Driver Protection</Text>
                <Text style={styles.passengerStatus}>Active & Monitoring</Text>
              </View>
            </View>
          </View>
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
  statusCard: { backgroundColor: '#1A2F4B', padding: 20, borderRadius: 15, marginBottom: 25, borderWidth: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 5 },
  indicator: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
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
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  statsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 30 },
  statBox: { width: '48%', backgroundColor: COLORS.card, padding: 15, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  statLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 5 },
  statValue: { color: COLORS.text, fontSize: 22, fontWeight: 'bold' },
  passengerCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#333', marginBottom: 25 },
  passengerInfo: { flexDirection: 'row', alignItems: 'center' },
  avatarCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  passengerName: { color: 'white', fontSize: 18, fontWeight: 'bold' },
  passengerStatus: { color: COLORS.success, fontSize: 12, fontWeight: '600', marginTop: 2 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { width: '48%', flexDirection: 'row', padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  actionText: { color: 'white', fontWeight: 'bold', marginLeft: 10 }
});