import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, doc, getDoc, onSnapshot, orderBy, query, setDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';

export default function WalletScreen() {
  const [activeTab, setActiveTab] = useState('trips'); // 'trips' or 'expenses'
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profile, setProfile] = useState({ businessName: '', taxId: '', displayName: '', lastExport: null });

  // New Expense Input State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ type: 'Gas', amount: '', vendor: '' });

  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // 1. Fetch Profile
    getDoc(doc(db, "users", user.uid)).then(docSnap => {
      if (docSnap.exists()) setProfile(docSnap.data());
    });

    // 2. Real-time Trip Logs
    const qTrips = query(collection(db, "trips"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
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
      setTotalSavings(savingsAcc.toFixed(2));
    });

    // 3. Real-time Expense Logs (NEW)
    const qExpenses = query(collection(db, "expenses"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      let expAcc = 0;
      const list = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        list.push({ id: doc.id, ...data });
        expAcc += parseFloat(data.amount || 0);
      });
      setExpenses(list);
      setTotalExpenses(expAcc.toFixed(2));
      setLoading(false);
    });

    return () => { unsubTrips(); unsubExpenses(); };
  }, [user]);

  // --- FIXED EXPORT FUNCTION ---
  const handleExport = async () => {
    if (trips.length === 0 && expenses.length === 0) {
      Alert.alert("No Data", "Track some trips or add expenses first!");
      return;
    }

    const exportDate = new Date().toLocaleString();
    let csv = `DRIVER PRO TAX REPORT\nGenerated: ${exportDate}\n`;
    csv += `Business: ${profile.businessName}\nTax ID: ${profile.taxId}\n\n`;
    
    csv += `--- TRIPS ---\nDate,Miles,Savings,ID\n`;
    trips.forEach(t => {
      const d = t.timestamp?.toDate().toLocaleDateString() || "N/A";
      csv += `${d},${t.miles},${t.savings},${t.id}\n`;
    });

    csv += `\n--- EXPENSES ---\nDate,Type,Vendor,Amount,ID\n`;
    expenses.forEach(e => {
      const d = e.timestamp?.toDate().toLocaleDateString() || "N/A";
      csv += `${d},${e.type},${e.vendor},${e.amount},${e.id}\n`;
    });

    const fileUri = `${FileSystem.documentDirectory}Tax_Report.csv`;
    
    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: FileSystem.EncodingType.UTF8 });
      // FIXED: Added UTI for better iOS compatibility
      await Sharing.shareAsync(fileUri, { 
        mimeType: 'text/csv', 
        dialogTitle: 'Export Tax Report',
        UTI: 'public.comma-separated-values-text' 
      });
      
      const timestamp = new Date().toISOString();
      await setDoc(doc(db, "users", user.uid), { lastExport: timestamp }, { merge: true });
      setProfile(prev => ({ ...prev, lastExport: timestamp }));
    } catch (error) {
      Alert.alert("Export Failed", error.message);
    }
  };

  const addExpense = async () => {
    if (!newExpense.amount || !newExpense.vendor) return Alert.alert("Missing Info", "Enter amount and vendor.");
    
    try {
      await addDoc(collection(db, "expenses"), {
        userId: user.uid,
        type: newExpense.type,
        amount: parseFloat(newExpense.amount),
        vendor: newExpense.vendor,
        timestamp: new Date()
      });
      setShowExpenseForm(false);
      setNewExpense({ type: 'Gas', amount: '', vendor: '' });
      Alert.alert("Saved", "Expense logged.");
    } catch (e) {
      Alert.alert("Error", "Could not save expense.");
    }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Tax Wallet</Text>
        <TouchableOpacity style={styles.exportBtn} onPress={handleExport}>
          <Ionicons name="share-outline" size={20} color={COLORS.primary} />
          <Text style={styles.exportText}>Export Report</Text>
        </TouchableOpacity>
      </View>

      {/* SUMMARY CARDS */}
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ maxHeight: 160, marginBottom: 20 }}>
        <View style={[styles.balanceCard, { width: 340, marginRight: 10 }]}>
          <Text style={styles.balanceLabel}>Potential Deduction</Text>
          <Text style={styles.balanceValue}>${(parseFloat(totalSavings) + parseFloat(totalExpenses)).toFixed(2)}</Text>
          <Text style={styles.lastExportText}>Includes Mileage & Expenses</Text>
        </View>
        <View style={[styles.balanceCard, { width: 340, backgroundColor: '#1A2F4B', borderColor: COLORS.primary }]}>
          <Text style={styles.balanceLabel}>Total Expenses</Text>
          <Text style={styles.balanceValue}>${totalExpenses}</Text>
          <Text style={[styles.lastExportText, { color: '#BDC3C7' }]}>Gas, Maintenance, Insurance</Text>
        </View>
      </ScrollView>

      {/* TABS */}
      <View style={styles.tabRow}>
        <TouchableOpacity onPress={() => setActiveTab('trips')} style={[styles.tab, activeTab === 'trips' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>Trips</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setActiveTab('expenses')} style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {activeTab === 'trips' ? (
          trips.map(t => (
            <View key={t.id} style={styles.itemRow}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(45, 108, 223, 0.1)' }]}>
                <Ionicons name="car" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.itemTitle}>{t.timestamp?.toDate().toLocaleDateString()}</Text>
                <Text style={styles.itemSub}>{t.miles} miles</Text>
              </View>
              <Text style={styles.itemValue}>+${t.savings}</Text>
            </View>
          ))
        ) : (
          <>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpenseForm(!showExpenseForm)}>
              <Ionicons name="add-circle" size={20} color="white" />
              <Text style={styles.addBtnText}>Add New Expense</Text>
            </TouchableOpacity>

            {showExpenseForm && (
              <View style={styles.formCard}>
                <View style={styles.typeRow}>
                  {['Gas', 'Repair', 'Ins.', 'Meal'].map(type => (
                    <TouchableOpacity key={type} onPress={() => setNewExpense({...newExpense, type})} 
                      style={[styles.typeChip, newExpense.type === type && styles.activeChip]}>
                      <Text style={[styles.chipText, newExpense.type === type && styles.activeChipText]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TextInput style={styles.input} placeholder="Vendor (e.g. Shell)" placeholderTextColor="#666" 
                  value={newExpense.vendor} onChangeText={t => setNewExpense({...newExpense, vendor: t})} />
                <TextInput style={styles.input} placeholder="Amount (0.00)" placeholderTextColor="#666" keyboardType="numeric"
                  value={newExpense.amount} onChangeText={t => setNewExpense({...newExpense, amount: t})} />
                <TouchableOpacity style={styles.saveBtn} onPress={addExpense}>
                  <Text style={styles.saveBtnText}>Save Expense</Text>
                </TouchableOpacity>
              </View>
            )}

            {expenses.map(e => (
              <View key={e.id} style={styles.itemRow}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                  <Ionicons name="receipt" size={20} color={COLORS.danger} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.itemTitle}>{e.vendor}</Text>
                  <Text style={styles.itemSub}>{e.type} • {e.timestamp?.toDate().toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.itemValue, { color: COLORS.text }]}>-${e.amount}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  exportBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A2F4B', padding: 8, borderRadius: 8 },
  exportText: { color: COLORS.primary, marginLeft: 5, fontWeight: 'bold' },
  balanceCard: { backgroundColor: COLORS.card, padding: 20, borderRadius: 15, borderWidth: 1, borderColor: '#333' },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 5 },
  balanceValue: { color: 'white', fontSize: 32, fontWeight: 'bold' },
  lastExportText: { color: COLORS.success, fontSize: 12, marginTop: 10 },
  tabRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#222', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#333' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: 'white' },
  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemSub: { color: '#888', fontSize: 12 },
  itemValue: { color: COLORS.success, fontWeight: 'bold', fontSize: 16 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444', borderRadius: 12, marginBottom: 15 },
  addBtnText: { color: 'white', marginLeft: 10, fontWeight: 'bold' },
  formCard: { backgroundColor: '#222', padding: 15, borderRadius: 12, marginBottom: 15 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  typeChip: { backgroundColor: '#333', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20 },
  activeChip: { backgroundColor: COLORS.primary },
  chipText: { color: 'white', fontSize: 12 },
  activeChipText: { fontWeight: 'bold' },
  input: { backgroundColor: '#111', color: 'white', padding: 12, borderRadius: 8, marginBottom: 10 },
  saveBtn: { backgroundColor: COLORS.success, padding: 12, borderRadius: 8, alignItems: 'center' },
  saveBtnText: { color: 'white', fontWeight: 'bold' }
});