import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system/legacy'; // Legacy import for SDK 52+
import * as ImagePicker from 'expo-image-picker'; // Camera Logic
import * as Sharing from 'expo-sharing';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';
import { generateTaxReport } from '../utils/PDFGenerator';

const screenWidth = Dimensions.get("window").width;

export default function WalletScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('expenses'); // Start on Expenses
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalSavings, setTotalSavings] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  
  // Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ type: 'Gas', amount: '', vendor: '', receiptUri: null });
  const [viewReceipt, setViewReceipt] = useState(null); // Holds the image URI to view in Modal

  const { isPremium } = useContext(UserContext); 
  const user = auth.currentUser;

  useEffect(() => {
    if (!user) return;

    // 1. Listen for Trips
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

    // 2. Listen for Expenses
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

  // --- RECEIPT SCANNING LOGIC ---
  const handleScanReceipt = async () => {
    Alert.alert("Upload Receipt", "Choose an option", [
      { text: "Camera", onPress: () => pickImage(true) },
      { text: "Gallery", onPress: () => pickImage(false) },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const pickImage = async (useCamera) => {
    let result;
    if (useCamera) {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permission denied");
      result = await ImagePicker.launchCameraAsync({ quality: 0.5 });
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permission denied");
      result = await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });
    }

    if (!result.canceled) {
      // Save permanently to document storage so it persists
      const uri = result.assets[0].uri;
      const fileName = `receipt_${Date.now()}.jpg`;
      const newPath = FileSystem.documentDirectory + fileName;
      
      try {
        await FileSystem.copyAsync({ from: uri, to: newPath });
        setNewExpense({ ...newExpense, receiptUri: newPath });
      } catch (e) {
        Alert.alert("Error", "Could not save receipt image.");
      }
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
        receiptUri: newExpense.receiptUri || null, // Save local image path
        timestamp: new Date()
      });
      setShowExpenseForm(false);
      setNewExpense({ type: 'Gas', amount: '', vendor: '', receiptUri: null });
    } catch (e) { Alert.alert("Error", "Could not save expense."); }
  };

  const confirmDelete = (id, collectionName) => {
    Alert.alert("Delete Item?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, collectionName, id)) }
    ]);
  };

  // --- EXPORT LOGIC ---
  const handleExportPDF = () => {
    if (!isPremium) return navigation.navigate('Premium');
    if (trips.length === 0) return Alert.alert("No Data", "Drive some miles first!");
    const totalDeduction = trips.reduce((sum, trip) => sum + (parseFloat(trip.miles || 0) * 0.67), 0);
    generateTaxReport(trips, totalDeduction, "2026");
  };

  const handleExportCSV = async () => {
    if (trips.length === 0 && expenses.length === 0) return Alert.alert("No Data", "Track some trips first!");
    const exportDate = new Date().toLocaleString();
    let csv = `DRIVER PRO TAX REPORT\nGenerated: ${exportDate}\n\n--- TRIPS ---\nDate,Miles,Savings\n`;
    trips.forEach(t => { csv += `${t.timestamp?.toDate().toLocaleDateString()},${t.miles},${t.savings}\n`; });
    csv += `\n--- EXPENSES ---\nDate,Type,Vendor,Amount,Receipt\n`;
    expenses.forEach(e => { csv += `${e.timestamp?.toDate().toLocaleDateString()},${e.type},${e.vendor},${e.amount},${e.receiptUri ? "Yes" : "No"}\n`; });
    const fileUri = `${FileSystem.documentDirectory}Tax_Report.csv`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(fileUri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
    } catch (error) { Alert.alert("Export Failed", error.message); }
  };

  // --- CHART DATA ---
  const chartData = [
    { name: 'Gas', population: expenses.filter(e => e.type === 'Gas').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#FF6384', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Repairs', population: expenses.filter(e => e.type === 'Repair').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#36A2EB', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Meals', population: expenses.filter(e => e.type === 'Meal').reduce((sum, e) => sum + e.amount, 0) || 10, color: '#FFCE56', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Other', population: expenses.filter(e => !['Gas','Repair','Meal'].includes(e.type)).reduce((sum, e) => sum + e.amount, 0) || 10, color: '#4BC0C0', legendFontColor: '#aaa', legendFontSize: 12 },
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
        
        {/* SUMMARY CARDS */}
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {/* Card 1: Total Deductions */}
          <View style={[styles.balanceCard, { width: screenWidth - 40, marginRight: 10 }]}>
            <Text style={styles.balanceLabel}>Total Tax Write-Off</Text>
            <Text style={styles.balanceValue}>${(parseFloat(totalSavings) + parseFloat(totalExpenses)).toFixed(2)}</Text>
            <Text style={styles.lastExportText}>Combined Mileage + Expenses</Text>
          </View>
          {/* Card 2: Expense Breakdown */}
          <View style={[styles.balanceCard, { width: screenWidth - 40, backgroundColor: '#2A2A2A' }]}>
             <Text style={styles.balanceLabel}>Expenses vs Mileage</Text>
             <Text style={[styles.balanceValue, {fontSize: 24, marginTop: 5}]}>Exp: ${totalExpenses}</Text>
             <Text style={[styles.balanceValue, {fontSize: 24}]}>Mile: ${totalSavings}</Text>
          </View>
        </ScrollView>

        {/* EXPENSE CHART */}
        {expenses.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Expense Breakdown</Text>
            <PieChart
              data={chartData}
              width={screenWidth - 40}
              height={220}
              chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              absolute
            />
          </View>
        )}

        {/* TABS */}
        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setActiveTab('expenses')} style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('trips')} style={[styles.tab, activeTab === 'trips' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>Mileage Logs</Text>
          </TouchableOpacity>
        </View>

        {/* ADD EXPENSE FORM */}
        {activeTab === 'expenses' && (
          <View>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpenseForm(!showExpenseForm)}>
              <Ionicons name={showExpenseForm ? "close" : "add"} size={24} color="white" />
              <Text style={styles.addBtnText}>{showExpenseForm ? "Cancel" : "Add Expense"}</Text>
            </TouchableOpacity>

            {showExpenseForm && (
              <View style={styles.formCard}>
                <Text style={styles.formTitle}>New Expense</Text>
                
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, {flex: 1}]} placeholder="Vendor (e.g. Shell)" placeholderTextColor="#666" value={newExpense.vendor} onChangeText={t => setNewExpense({...newExpense, vendor: t})} />
                  <TextInput style={[styles.input, {width: 100, marginLeft: 10}]} placeholder="$0.00" keyboardType="numeric" placeholderTextColor="#666" value={newExpense.amount} onChangeText={t => setNewExpense({...newExpense, amount: t})} />
                </View>

                <View style={styles.typeRow}>
                  {['Gas', 'Repair', 'Meal', 'Other'].map(type => (
                    <TouchableOpacity key={type} style={[styles.typeChip, newExpense.type === type && styles.activeType]} onPress={() => setNewExpense({...newExpense, type})}>
                      <Text style={[styles.typeText, newExpense.type === type && styles.activeTypeText]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* RECEIPT PREVIEW / SCAN BUTTON */}
                {newExpense.receiptUri ? (
                  <View style={styles.previewContainer}>
                    <Image source={{ uri: newExpense.receiptUri }} style={styles.receiptPreview} />
                    <TouchableOpacity style={styles.removeReceipt} onPress={() => setNewExpense({...newExpense, receiptUri: null})}>
                      <Ionicons name="trash" size={20} color="white" />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.scanBtn} onPress={handleScanReceipt}>
                    <Ionicons name="camera" size={24} color={COLORS.primary} />
                    <Text style={styles.scanText}>Scan Receipt</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={addExpense}>
                  <Text style={styles.saveText}>Save Expense</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* EXPENSES LIST */}
            {expenses.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemRow} onLongPress={() => confirmDelete(item.id, 'expenses')}>
                <View style={styles.iconBox}>
                  <Ionicons name={item.type === 'Gas' ? 'color-fill' : item.type === 'Repair' ? 'build' : 'card'} size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.itemVendor}>{item.vendor}</Text>
                  <Text style={styles.itemDate}>{item.timestamp?.toDate().toLocaleDateString()}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemAmount}>-${item.amount.toFixed(2)}</Text>
                  {/* Receipt Icon */}
                  {item.receiptUri && (
                    <TouchableOpacity onPress={() => setViewReceipt(item.receiptUri)}>
                      <Ionicons name="receipt-outline" size={16} color="#aaa" style={{marginTop: 4}} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* TRIPS LIST */}
        {activeTab === 'trips' && trips.map((item) => (
          <TouchableOpacity key={item.id} style={styles.itemRow} onLongPress={() => confirmDelete(item.id, 'trips')}>
            <View style={[styles.iconBox, {backgroundColor: '#2A2A2A'}]}>
              <Ionicons name="navigate" size={24} color="#4BC0C0" />
            </View>
            <View style={{ flex: 1, marginLeft: 15 }}>
              <Text style={styles.itemVendor}>Business Trip</Text>
              <Text style={styles.itemDate}>{item.timestamp?.toDate().toLocaleDateString()}</Text>
            </View>
            <View>
              <Text style={[styles.itemAmount, {color: COLORS.success}]}>+${parseFloat(item.savings).toFixed(2)}</Text>
              <Text style={styles.itemSub}>{parseFloat(item.miles).toFixed(1)} mi</Text>
            </View>
          </TouchableOpacity>
        ))}

        <View style={{height: 100}} />
      </ScrollView>

      {/* RECEIPT MODAL */}
      <Modal visible={!!viewReceipt} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeModal} onPress={() => setViewReceipt(null)}>
            <Ionicons name="close-circle" size={50} color="white" />
          </TouchableOpacity>
          {viewReceipt && <Image source={{ uri: viewReceipt }} style={styles.fullReceipt} resizeMode="contain" />}
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, paddingHorizontal: 20 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, marginBottom: 20 },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white' },
  exportBtn: { flexDirection: 'row', backgroundColor: '#333', padding: 8, borderRadius: 8, alignItems: 'center' },
  exportText: { color: COLORS.primary, marginLeft: 5, fontWeight: 'bold' },
  
  balanceCard: { backgroundColor: COLORS.card, borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#333', height: 140, justifyContent: 'center' },
  balanceLabel: { color: COLORS.textSecondary, fontSize: 14, marginBottom: 5 },
  balanceValue: { color: 'white', fontSize: 36, fontWeight: 'bold' },
  lastExportText: { color: COLORS.success, fontSize: 12, marginTop: 5 },

  chartContainer: { alignItems: 'center', marginBottom: 20, backgroundColor: '#1E1E1E', borderRadius: 15, padding: 10 },
  sectionTitle: { color: 'white', fontWeight: 'bold', marginBottom: 10 },

  tabRow: { flexDirection: 'row', marginBottom: 20, backgroundColor: '#333', borderRadius: 10, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#1E1E1E' },
  tabText: { color: '#888', fontWeight: 'bold' },
  activeTabText: { color: 'white' },

  addBtn: { flexDirection: 'row', backgroundColor: COLORS.primary, padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 15 },
  addBtnText: { color: 'black', fontWeight: 'bold', marginLeft: 5 },

  formCard: { backgroundColor: '#252525', padding: 15, borderRadius: 12, marginBottom: 20 },
  formTitle: { color: 'white', fontWeight: 'bold', marginBottom: 15 },
  inputRow: { flexDirection: 'row', marginBottom: 15 },
  input: { backgroundColor: '#121212', color: 'white', padding: 12, borderRadius: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#333' },
  activeType: { backgroundColor: COLORS.primary },
  typeText: { color: 'white', fontSize: 12 },
  activeTypeText: { color: 'black', fontWeight: 'bold' },
  scanBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#444', borderRadius: 8, marginBottom: 15, borderStyle: 'dashed' },
  scanText: { color: COLORS.primary, marginLeft: 10 },
  saveBtn: { backgroundColor: COLORS.success, padding: 15, borderRadius: 8, alignItems: 'center' },
  saveText: { color: 'white', fontWeight: 'bold' },

  previewContainer: { marginBottom: 15, alignItems: 'center' },
  receiptPreview: { width: 100, height: 100, borderRadius: 10 },
  removeReceipt: { position: 'absolute', top: -10, right: -10, backgroundColor: COLORS.danger, borderRadius: 15, padding: 5 },

  itemRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 12, marginBottom: 10 },
  iconBox: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#333', justifyContent: 'center', alignItems: 'center' },
  itemVendor: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemDate: { color: '#888', fontSize: 12 },
  itemAmount: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemSub: { color: '#888', fontSize: 12, textAlign: 'right' },

  modalContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullReceipt: { width: '100%', height: '80%' },
  closeModal: { position: 'absolute', top: 50, right: 20, zIndex: 10 }
});