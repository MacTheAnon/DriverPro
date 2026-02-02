import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, deleteDoc, doc, getDoc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit'; // Make sure this is installed
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext'; // <--- Brain Import
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';
import { generateTaxReport } from '../utils/PDFGenerator';

const screenWidth = Dimensions.get("window").width;

export default function WalletScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('trips'); 
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profile, setProfile] = useState({ businessName: '', taxId: '', displayName: '', lastExport: null });

  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ type: 'Gas', amount: '', vendor: '' });

  const { isPremium } = useContext(UserContext); // <--- Check Premium Status
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

    // 3. Real-time Expense Logs
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

  // --- PREMIUM PDF EXPORT ---
  const handleExportPDF = () => {
    if (!isPremium) {
      navigation.navigate('Premium'); // Send to Paywall
      return;
    }

    if (trips.length === 0) {
      Alert.alert("No Data", "Drive some miles first!");
      return;
    }

    const totalDeduction = trips.reduce((sum, trip) => sum + (parseFloat(trip.miles || 0) * 0.67), 0);
    generateTaxReport(trips, totalDeduction, "2026");
  };

  // --- STANDARD CSV EXPORT ---
  const handleExportCSV = async () => {
    if (trips.length === 0 && expenses.length === 0) return Alert.alert("No Data", "Track some trips first!");

    const exportDate = new Date().toLocaleString();
    let csv = `DRIVER PRO TAX REPORT\nGenerated: ${exportDate}\n\n`;
    
    csv += `--- TRIPS ---\nDate,Miles,Savings\n`;
    trips.forEach(t => {
      csv += `${t.timestamp?.toDate().toLocaleDateString()},${t.miles},${t.savings}\n`;
    });

    csv += `\n--- EXPENSES ---\nDate,Type,Vendor,Amount\n`;
    expenses.forEach(e => {
      csv += `${e.timestamp?.toDate().toLocaleDateString()},${e.type},${e.vendor},${e.amount}\n`;
    });

    const fileUri = `${FileSystem.documentDirectory}Tax_Report.csv`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error) {
      Alert.alert("Export Failed", error.message);
    }
  };

  const confirmDelete = (id, collectionName) => {
    Alert.alert("Delete Item?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, collectionName, id)) }
    ]);
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
    } catch (e) { Alert.alert("Error", "Could not save expense."); }
  };

  // Prepare Chart Data
  const chartData = [
    { name: 'Gas', population: expenses.filter(e => e.type === 'Gas').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#FF6384', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Maint', population: expenses.filter(e => e.type === 'Repair').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#36A2EB', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Other', population: expenses.filter(e => e.type !== 'Gas' && e.type !== 'Repair').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#FFCE56', legendFontColor: '#aaa', legendFontSize: 12 },
  ];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.title}>Tax Wallet</Text>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity style={[styles.exportBtn, {marginRight: 10}]} onPress={handleExportCSV}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
            <Text style={styles.exportText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, {backgroundColor: '#2e7d32'}]} onPress={handleExportPDF}>
            <Ionicons name="print-outline" size={20} color="white" />
            <Text style={[styles.exportText, {color: 'white'}]}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>

        {/* BALANCE CARDS */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={[styles.balanceCard, { width: screenWidth - 40, marginRight: 10 }]}>
            <Text style={styles.balanceLabel}>Potential Deduction</Text>
            <Text style={styles.balanceValue}>${(parseFloat(totalSavings) + parseFloat(totalExpenses)).toFixed(2)}</Text>
            <Text style={styles.lastExportText}>Includes Mileage & Expenses</Text>
          </View>
        </ScrollView>

        {/* PREMIUM ANALYTICS SECTION */}
        <View style={styles.chartContainer}>
          <Text style={styles.sectionTitle}>Monthly Spend Breakdown</Text>
          
          {isPremium ? (
             <PieChart
               data={chartData}
               width={screenWidth - 40}
               height={200}
               chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
               accessor={"population"}
               backgroundColor={"transparent"}
               paddingLeft={"0"}
               center={[10, 0]}
               absolute
             />
          ) : (
            <TouchableOpacity style={styles.lockedContainer} onPress={() => navigation.navigate('Premium')}>
              <Ionicons name="lock-closed" size={40} color="#666" />
              <Text style={styles.lockedText}>Upgrade to see Spending Analytics</Text>
              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeBtnText}>Unlock Pro</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* TABS */}
        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setActiveTab('trips')} style={[styles.tab, activeTab === 'trips' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>Trips</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('expenses')} style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
          </TouchableOpacity>
        </View>

        {/* CONTENT LIST */}
        {activeTab === 'trips' ? (
          trips.length === 0 ? <Text style={styles.emptyText}>No trips recorded yet.</Text> :
          trips.map(t => (
            <TouchableOpacity key={t.id} style={styles.itemRow} onLongPress={() => confirmDelete(t.id, "trips")}>
              <View style={[styles.iconBox, { backgroundColor: 'rgba(45, 108, 223, 0.1)' }]}>
                <Ionicons name="car" size={20} color={COLORS.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.itemTitle}>{t.timestamp?.toDate().toLocaleDateString()}</Text>
                <Text style={styles.itemSub}>{t.miles} miles</Text>
              </View>
              <Text style={styles.itemValue}>+${t.savings}</Text>
            </TouchableOpacity>
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
              <TouchableOpacity key={e.id} style={styles.itemRow} onLongPress={() => confirmDelete(e.id, "expenses")}>
                <View style={[styles.iconBox, { backgroundColor: 'rgba(231, 76, 60, 0.1)' }]}>
                  <Ionicons name="receipt" size={20} color={COLORS.danger} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.itemTitle}>{e.vendor}</Text>
                  <Text style={styles.itemSub}>{e.type} • {e.timestamp?.toDate().toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.itemValue, { color: COLORS.text }]}>-${e.amount}</Text>
              </TouchableOpacity>
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
  
  // Chart & Locked Styles
  chartContainer: { backgroundColor: '#1E1E1E', borderRadius: 15, padding: 15, marginBottom: 20 },
  sectionTitle: { color: '#888', fontSize: 14, marginBottom: 10, fontWeight: '600' },
  lockedContainer: { height: 180, justifyContent: 'center', alignItems: 'center', backgroundColor: '#252525', borderRadius: 10 },
  lockedText: { color: '#888', marginTop: 10, marginBottom: 15 },
  upgradeButton: { backgroundColor: '#2e7d32', paddingHorizontal: 20, paddingVertical: 8, borderRadius: 20 },
  upgradeBtnText: { color: 'white', fontWeight: 'bold' },

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
  saveBtnText: { color: 'white', fontWeight: 'bold' },
  emptyText: { color: '#666', textAlign: 'center', marginTop: 20 }
});