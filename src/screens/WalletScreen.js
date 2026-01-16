import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function WalletScreen() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalMiles, setTotalMiles] = useState(0);
  const [profile, setProfile] = useState({ businessName: '', taxId: '', displayName: '', lastExport: null });

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Profile (Business Info + Last Export Date)
    const fetchProfile = async () => {
      try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
          setProfile(docSnap.data());
        }
      } catch (e) {
        console.log("Profile Fetch Error:", e);
      }
    };
    fetchProfile();

    // 2. Real-time Trip Logs
    const q = query(
      collection(db, "trips"), 
      where("userId", "==", user.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let milesAcc = 0;
      let savingsAcc = 0;
      const list = [];

      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data });
        milesAcc += parseFloat(data.miles || 0);
        savingsAcc += parseFloat(data.savings || 0);
      });

      setTrips(list);
      setTotalMiles(milesAcc.toFixed(1));
      setTotalSavings(savingsAcc.toFixed(2));
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- FEATURE 1: DYNAMIC CSV EXPORT ---
  const handleExport = async () => {
    if (trips.length === 0) {
      Alert.alert("No Data", "Track some trips before exporting!");
      return;
    }

    const exportDate = new Date().toLocaleString();
    let csvContent = `TAX DEDUCTION REPORT\n`;
    csvContent += `Business: ${profile.businessName || 'Independent Contractor'}\n`;
    csvContent += `Tax ID: ${profile.taxId || 'N/A'}\n`;
    csvContent += `Generated: ${exportDate}\n\n`;
    csvContent += "Date,Miles,Tax Savings (USD),Trip ID\n";

    trips.forEach(trip => {
      const date = trip.timestamp?.toDate().toLocaleDateString() || "N/A";
      csvContent += `${date},${trip.miles},${trip.savings},${trip.id}\n`;
    });

    const fileUri = `${FileSystem.documentDirectory}DriverPro_Tax_Report.csv`;
    
    try {
      await FileSystem.writeAsStringAsync(fileUri, csvContent, { encoding: FileSystem.EncodingType.UTF8 });
      await Sharing.shareAsync(fileUri);
      
      // Update the "Last Exported" timestamp in the cloud
      const timestamp = new Date().toISOString();
      await setDoc(doc(db, "users", user.uid), { lastExport: timestamp }, { merge: true });
      setProfile(prev => ({ ...prev, lastExport: timestamp }));

    } catch (error) {
      Alert.alert("Export Error", "Could not generate report.");
    }
  };

  // --- FEATURE 2: SUPPORT EMAIL ---
  const handleSupport = () => {
    const subject = `Wallet Support: ${profile.displayName || 'User'}`;
    const body = `User ID: ${user.uid}\nBusiness: ${profile.businessName}\n\nDescribe your issue here:`;
    const url = `mailto:support@driverpro.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    Linking.openURL(url).catch(() => Alert.alert("Error", "Could not open email app."));
  };

  // --- FEATURE 3: DELETE TRIP ---
  const confirmDelete = (tripId) => {
    Alert.alert("Delete Record", "Remove this trip from your business logs?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteDoc(doc(db, "trips", tripId)) }
    ]);
  };

  // --- FEATURE 4: IMPORT STATEMENT (PHASE 2) ---
  const handleImportStatement = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "text/csv"] });
      if (!result.canceled) {
        Alert.alert("Phase 2 Automation", `Statement ${result.assets[0].name} detected. AI parsing coming soon!`);
      }
    } catch (err) { console.log(err); }
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
      {/* HEADER WITH ACTIONS */}
      <View style={styles.header}>
        <Text style={styles.title}>Tax Wallet</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.supportIcon} onPress={handleSupport}>
            <Ionicons name="help-buoy-outline" size={24} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
            <Ionicons name="download-outline" size={20} color={COLORS.primary} />
            <Text style={styles.exportText}>Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* SUMMARY CARD */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Total Tax Savings (2026)</Text>
          <Text style={styles.balanceValue}>${totalSavings}</Text>
          
          {profile.lastExport && (
            <Text style={styles.lastExportText}>
              Last backed up: {new Date(profile.lastExport).toLocaleDateString()}
            </Text>
          )}

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

        {/* SECTION HEADER */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Trips</Text>
          <TouchableOpacity onPress={handleImportStatement}>
            <Text style={styles.importLink}>+ Import Statement</Text>
          </TouchableOpacity>
        </View>
        
        {/* TRIP LIST */}
        {trips.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="leaf-outline" size={50} color="#333" />
            <Text style={styles.emptyText}>No trips tracked yet.</Text>
          </View>
        ) : (
          trips.map((item) => (
            <TouchableOpacity key={item.id} style={styles.tripItem} onLongPress={() => confirmDelete(item.id)} activeOpacity={0.7}>
              <View style={styles.iconCircle}>
                <Ionicons name="car-outline" size={24} color={COLORS.primary} />
              </View>
              <View style={styles.tripDetails}>
                <Text style={styles.tripDate}>{item.timestamp?.toDate().toLocaleDateString() || "Recent Trip"}</Text>
                <Text style={styles.tripMiles}>{item.miles} miles tracked</Text>
              </View>
              <View style={styles.tripSavings}>
                <Text style={styles.savingsValue}>+${item.savings}</Text>
                <Text style={styles.holdText}>Hold to delete</Text>
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
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  supportIcon: { marginRight: 15, padding: 5 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2F4B', padding: 8, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary },
  exportText: { color: COLORS.primary, marginLeft: 5, fontWeight: '600' },
  balanceCard: { backgroundColor: COLORS.card, padding: 25, borderRadius: 20, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 10 },
  balanceValue: { color: COLORS.text, fontSize: 42, fontWeight: 'bold', marginBottom: 5 },
  lastExportText: { color: COLORS.success, fontSize: 12, fontWeight: '600', marginBottom: 15 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#333', paddingTop: 20 },
  miniStat: { flex: 1, alignItems: 'center' },
  miniLabel: { color: COLORS.textSecondary, fontSize: 10, fontWeight: 'bold' },
  miniValue: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginTop: 4 },
  divider: { width: 1, height: '100%', backgroundColor: '#333' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  importLink: { color: COLORS.primary, fontWeight: 'bold', fontSize: 14 },
  tripItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 15, marginBottom: 12, borderWidth: 1, borderColor: '#333' },
  iconCircle: { width: 45, height: 45, borderRadius: 22.5, backgroundColor: '#1A2F4B', justifyContent: 'center', alignItems: 'center' },
  tripDetails: { flex: 1, marginLeft: 15 },
  tripDate: { color: COLORS.text, fontSize: 14, fontWeight: 'bold' },
  tripMiles: { color: COLORS.textSecondary, fontSize: 12, marginTop: 2 },
  tripSavings: { alignItems: 'flex-end' },
  savingsValue: { color: COLORS.success, fontSize: 16, fontWeight: 'bold' },
  holdText: { fontSize: 10, color: '#555', marginTop: 2 },
  emptyContainer: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: '#555', marginTop: 10, fontSize: 16 }
});