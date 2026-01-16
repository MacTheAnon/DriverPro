import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function WalletScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalMiles, setTotalMiles] = useState(0);

  useEffect(() => {
    const tripsRef = collection(db, "trips");
    
    const q = query(
      tripsRef, 
      where("userId", "==", auth.currentUser?.uid || "test_user_kaleb"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      let milesAccumulated = 0;
      let savingsAccumulated = 0;
      const tripsList = [];

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        tripsList.push({ id: doc.id, ...data });
        
        // Ensure we are adding numbers, not strings
        milesAccumulated += parseFloat(data.miles || 0);
        savingsAccumulated += parseFloat(data.savings || 0);
      });

      setTrips(tripsList);
      setTotalMiles(milesAccumulated.toFixed(1));
      setTotalSavings(savingsAccumulated.toFixed(2));
      setLoading(false);
    }, (error) => {
      console.error("Wallet Fetch Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- 1. EXPORT TO CSV LOGIC ---
  const exportToCSV = async () => {
    if (trips.length === 0) {
      Alert.alert("No Data", "Track some trips before exporting!");
      return;
    }

    let csvContent = "Date,Miles,Tax Savings,Trip ID\n";
    trips.forEach(trip => {
      const date = trip.timestamp?.toDate().toLocaleDateString() || "N/A";
      csvContent += `${date},${trip.miles},${trip.savings},${trip.id}\n`;
    });

    const fileName = `${FileSystem.documentDirectory}DriverPro_Tax_Report.csv`;
    
    try {
      await FileSystem.writeAsStringAsync(fileName, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileName);
    } catch (error) {
      Alert.alert("Export Failed", error.message);
    }
  };

  // --- 2. DELETE TRIP LOGIC (To clean up test data) ---
  const confirmDelete = (tripId) => {
    Alert.alert(
      "Delete Trip",
      "Are you sure you want to remove this trip from your records?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteTrip(tripId) }
      ]
    );
  };

  const deleteTrip = async (tripId) => {
    try {
      await deleteDoc(doc(db, "trips", tripId));
    } catch (error) {
      Alert.alert("Error", "Could not delete trip.");
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: 'center' }]}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tax Wallet</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={exportToCSV}>
          <Ionicons name="download-outline" size={20} color={COLORS.primary} />
          <Text style={styles.exportText}>Export</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* REAL BALANCE CARD */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Tax Savings (2026)</Text>
          <Text style={styles.balanceValue}>${totalSavings}</Text>
          <View style={styles.statsRow}>
            <View style={styles.miniStat}>
              <Text style={styles.miniLabel}>TOTAL MILES</Text>
              <Text style={styles.miniValue}>{totalMiles}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.miniStat}>
              <Text style={styles.miniLabel}>IRS RATE</Text>
              <Text style={styles.miniValue}>$0.675/mi</Text>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Recent Trips</Text>
        
        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={50} color="#333" />
            <Text style={styles.emptyText}>No trips tracked yet.</Text>
          </View>
        ) : (
          trips.map((item) => (
            <TouchableOpacity 
              key={item.id} 
              style={styles.tripItem}
              onLongPress={() => confirmDelete(item.id)}
              activeOpacity={0.7}
            >
              <View style={styles.iconCircle}>
                <Ionicons name="car-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.tripDetails}>
                <Text style={styles.tripDate}>
                  {item.timestamp?.toDate().toLocaleDateString() || "Recent Trip"}
                </Text>
                <Text style={styles.tripMiles}>{item.miles} miles tracked</Text>
              </View>
              <View style={styles.tripSavings}>
                <Text style={styles.savingsValue}>+${item.savings}</Text>
                <Text style={{fontSize: 10, color: '#555'}}>Hold to delete</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2F4B', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary },
  exportText: { color: COLORS.primary, marginLeft: 5, fontWeight: '600' },
  balanceCard: { backgroundColor: COLORS.card, padding: 25, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 10 },
  balanceValue: { color: COLORS.text, fontSize: 42, fontWeight: 'bold', marginBottom: 20 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 20 },
  miniStat: { flex: 1, alignItems: 'center' },
  miniLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' },
  miniValue: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  divider: { width: 1, height: '100%', backgroundColor: '#333' },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold', marginBottom: 15 },
  tripItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 15, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  iconCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1A2F4B', justifyContent: 'center', alignItems: 'center' },
  tripDetails: { flex: 1, marginLeft: 15 },
  tripDate: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  tripMiles: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  tripSavings: { alignItems: 'flex-end' },
  savingsValue: { color: COLORS.success, fontSize: 16, fontWeight: 'bold' },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#555', marginTop: 10, fontSize: 16 }
});