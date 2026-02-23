import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import * as Sharing from 'expo-sharing';
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useContext, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserContext } from '../context/UserContext';
import { auth, db } from '../firebaseConfig';
import COLORS from '../styles/colors';
import { generateTaxReport } from '../utils/PDFGenerator';

const screenWidth = Dimensions.get("window").width;

// FIX: Robust image detection — .endsWith('.jpg') misses uppercase extensions (.JPG),
// temp camera paths with no extension, and anything picked via DocumentPicker.
function isImageUri(uri) {
  if (!uri) return false;
  const lower = uri.toLowerCase();
  return lower.includes('.jpg') || lower.includes('.jpeg') || lower.includes('.png') || lower.includes('.webp') || lower.includes('.heic');
}

export default function WalletScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState('expenses'); 
  const [trips, setTrips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false); // FIX: separate state for expense save so Firestore snapshots don't race with the save spinner
  
  // Expense Form State
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [newExpense, setNewExpense] = useState({ type: 'Gas', amount: '', vendor: '', receiptUri: null, fileName: null });
  const [viewReceipt, setViewReceipt] = useState(null); 

  const { isPremium } = useContext(UserContext); 
  const user = auth.currentUser;

  // Real-time Data Listeners
  useEffect(() => {
    if (!user) return;

    const qTrips = query(collection(db, "trips"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubTrips = onSnapshot(qTrips, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTrips(list);
      setLoading(false);
    });

    const qExpenses = query(collection(db, "expenses"), where("userId", "==", user.uid), orderBy("timestamp", "desc"));
    const unsubExpenses = onSnapshot(qExpenses, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setExpenses(list);
      setLoading(false);
    });

    return () => { unsubTrips(); unsubExpenses(); };
  }, [user]);

  // Memoized Totals
  const totalSavings = useMemo(() => 
    trips.reduce((sum, t) => sum + (parseFloat(t.savings) || 0), 0), [trips]);
  
  const totalExpenses = useMemo(() => 
    expenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0), [expenses]);

  // Receipt/File Upload
  const handleScanReceipt = async () => {
    Alert.alert("Upload Receipt", "Choose an option", [
      { text: "Camera", onPress: () => pickImage(true) },
      { text: "Gallery", onPress: () => pickImage(false) },
      { text: "Files", onPress: pickFile },
      { text: "Cancel", style: "cancel" }
    ]);
  };

  const pickImage = async (useCamera) => {
    let result;
    const permission = useCamera 
      ? await ImagePicker.requestCameraPermissionsAsync() 
      : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permission.status !== 'granted') {
      return Alert.alert("Permission denied", "We need access to your camera/gallery to scan receipts.");
    }

    result = useCamera 
      ? await ImagePicker.launchCameraAsync({ quality: 0.5 }) 
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.5 });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      const fileName = `receipt_${Date.now()}.jpg`;
      const newPath = FileSystem.documentDirectory + fileName;
      try {
        await FileSystem.copyAsync({ from: uri, to: newPath });
        setNewExpense({ ...newExpense, receiptUri: newPath, fileName });
      } catch (e) {
        Alert.alert("Error", "Could not save receipt image.");
      }
    }
  };

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      // FIX: expo-document-picker v5+ returns { canceled, assets } — not result.type === 'success'
      if (!result.canceled && result.assets?.length > 0) {
        const asset = result.assets[0];
        setNewExpense({ ...newExpense, receiptUri: asset.uri, fileName: asset.name });
      }
    } catch (error) {
      Alert.alert("Error", "Could not select file.");
    }
  };

  const addExpense = async () => {
    if (!newExpense.vendor.trim()) return Alert.alert("Missing Info", "Please enter a vendor.");

    const amount = parseFloat(newExpense.amount);
    if (isNaN(amount) || amount <= 0) return Alert.alert("Invalid Amount", "Please enter a valid number greater than 0.");

    // FIX: Use separate saving state so Firestore snapshot listeners firing during save
    // don't accidentally reset the spinner by calling setLoading(false).
    setSaving(true);

    try {
      let finalReceiptUri = null;

      if (newExpense.receiptUri) {
        // FIX: Save receipt locally (Firebase Storage was removed from firebaseConfig.js).
        // Local storage matches DocumentUploadScreen and DocumentsScreen strategy.
        try {
          const ext = newExpense.fileName?.split('.').pop()?.toLowerCase() || 'jpg';
          const localPath = `${FileSystem.documentDirectory}receipt_${user.uid}_${Date.now()}.${ext}`;
          await FileSystem.copyAsync({ from: newExpense.receiptUri, to: localPath });
          finalReceiptUri = localPath;
        } catch (saveError) {
          console.error("Receipt local save failed:", saveError);
          Alert.alert("Receipt Error", "Could not save receipt. The expense will be saved without it.");
          // Don't return — save the expense anyway without the receipt
        }
      }

      await addDoc(collection(db, "expenses"), {
        userId: user.uid,
        type: newExpense.type,
        amount: amount,
        vendor: newExpense.vendor.trim(),
        receiptUri: finalReceiptUri,
        timestamp: new Date(),
        fileName: newExpense.fileName
      });

      setNewExpense({ type: "Gas", amount: "", vendor: "", receiptUri: null, fileName: null });
      setShowExpenseForm(false);

    } catch (e) {
      console.error("Failed to save expense:", e);
      Alert.alert("Error", "Could not save expense. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id, collectionName) => {
    Alert.alert("Delete Item?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => await deleteDoc(doc(db, collectionName, id)) }
    ]);
  };

  const handleExportPDF = async () => {
    if (!isPremium) {
      navigation.navigate('Premium');
      return;
    }
    if (trips.length === 0) return Alert.alert("No Data", "Drive some miles first!");
    try {
      const currentYear = new Date().getFullYear().toString();
      await generateTaxReport(trips, totalSavings, currentYear);
    } catch (error) {
      Alert.alert("Export Error", "Something went wrong while creating the PDF.");
    }
  };

  const handleExportCSV = async () => {
    if (trips.length === 0 && expenses.length === 0) return Alert.alert("No Data", "Track some trips first!");
    
    let csv = `DRIVER PRO TAX REPORT\nGenerated: ${new Date().toLocaleString()}\n\n--- TRIPS ---\nDate,Miles,Savings\n`;
    trips.forEach(t => { 
        const date = t.timestamp?.toDate ? t.timestamp.toDate().toLocaleDateString() : 'N/A';
        csv += `${date},${t.miles},${t.savings}\n`; 
    });
    
    csv += `\n--- EXPENSES ---\nDate,Type,Vendor,Amount,Receipt\n`;
    expenses.forEach(e => { 
        const date = e.timestamp?.toDate ? e.timestamp.toDate().toLocaleDateString() : 'N/A';
        csv += `${date},${e.type},${e.vendor},${e.amount},${e.receiptUri ? "Yes" : "No"}\n`; 
    });

    const fileUri = `${FileSystem.documentDirectory}Tax_Report.csv`;
    try {
      await FileSystem.writeAsStringAsync(fileUri, csv, { encoding: 'utf8' });
      await Sharing.shareAsync(fileUri);
    } catch (error) { Alert.alert("Export Failed", error.message); }
  };

  const getCategoryTotal = (cat) => expenses.filter(e => e.type === cat).reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  
  const chartData = [
    { name: 'Gas', population: getCategoryTotal('Gas') || 0.01, color: '#FF6384', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Repair', population: getCategoryTotal('Repair') || 0.01, color: '#36A2EB', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Meal', population: getCategoryTotal('Meal') || 0.01, color: '#FFCE56', legendFontColor: '#aaa', legendFontSize: 12 },
    { name: 'Other', population: getCategoryTotal('Other') || 0.01, color: '#4BC0C0', legendFontColor: '#aaa', legendFontSize: 12 },
  ];

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /></View>;

  return (
    <SafeAreaView style={styles.container}>
      {saving && (
        <View style={{
          ...StyleSheet.absoluteFillObject,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center', alignItems: 'center',
          zIndex: 1000
        }}>
          <ActivityIndicator size="large" color={COLORS.success} />
          <Text style={{color: 'white', marginTop: 10}}>Saving Expense...</Text>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.title}>Tax Wallet</Text>
        <View style={{flexDirection: 'row'}}>
          <TouchableOpacity style={[styles.exportBtn, {marginRight: 10}]} onPress={handleExportCSV}>
            <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
            <Text style={styles.exportText}>CSV</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.exportBtn, {backgroundColor: COLORS.success}]} onPress={handleExportPDF}>
            <Ionicons name="print-outline" size={20} color="white" />
            <Text style={[styles.exportText, {color: 'white'}]}>PDF</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          <View style={[styles.balanceCard, { width: screenWidth - 40, marginRight: 10 }]}>
            <Text style={styles.balanceLabel}>Total Tax Write-Off</Text>
            <Text style={styles.balanceValue}>${(totalSavings + totalExpenses).toFixed(2)}</Text>
            <Text style={styles.lastExportText}>Combined Mileage + Expenses</Text>
          </View>
          <View style={[styles.balanceCard, { width: screenWidth - 40, backgroundColor: '#2A2A2A' }]}>
             <Text style={styles.balanceLabel}>Breakdown</Text>
             <Text style={[styles.balanceValue, {fontSize: 22, marginTop: 5}]}>Expenses: ${totalExpenses.toFixed(2)}</Text>
             <Text style={[styles.balanceValue, {fontSize: 22}]}>Mileage: ${totalSavings.toFixed(2)}</Text>
          </View>
        </ScrollView>

        {expenses.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.sectionTitle}>Expense Breakdown</Text>
            <PieChart
              data={chartData}
              width={screenWidth - 60}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})` }}
              accessor={"population"}
              backgroundColor={"transparent"}
              paddingLeft={"15"}
              absolute
            />
          </View>
        )}

        <View style={styles.tabRow}>
          <TouchableOpacity onPress={() => setActiveTab('expenses')} style={[styles.tab, activeTab === 'expenses' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'expenses' && styles.activeTabText]}>Expenses</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setActiveTab('trips')} style={[styles.tab, activeTab === 'trips' && styles.activeTab]}>
            <Text style={[styles.tabText, activeTab === 'trips' && styles.activeTabText]}>Mileage Logs</Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'expenses' ? (
          <View>
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowExpenseForm(!showExpenseForm)}>
              <Ionicons name={showExpenseForm ? "close" : "add"} size={24} color="black" />
              <Text style={styles.addBtnText}>{showExpenseForm ? "Cancel" : "Add Expense"}</Text>
            </TouchableOpacity>

            {showExpenseForm && (
              <View style={styles.formCard}>
                <View style={styles.inputRow}>
                  <TextInput style={[styles.input, {flex: 1}]} placeholder="Vendor" placeholderTextColor="#666" value={newExpense.vendor} onChangeText={t => setNewExpense({...newExpense, vendor: t})} />
                  <TextInput style={[styles.input, {width: 100, marginLeft: 10}]} placeholder="$0.00" keyboardType="numeric" placeholderTextColor="#666" value={newExpense.amount} onChangeText={t => setNewExpense({...newExpense, amount: t})} />
                </View>

                <View style={styles.typeRow}>
                  {['Gas', 'Repair', 'Meal', 'Other'].map(type => (
                    <TouchableOpacity key={type} style={[styles.typeChip, newExpense.type === type && styles.activeType]} onPress={() => setNewExpense({...newExpense, type})}>
                      <Text style={[styles.typeText, newExpense.type === type && styles.activeTypeText]}>{type}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {newExpense.receiptUri ? (
                  isImageUri(newExpense.receiptUri) ? (
                    <View style={styles.previewContainer}>
                      <Image source={{ uri: newExpense.receiptUri }} style={styles.receiptPreview} />
                      <TouchableOpacity style={styles.removeReceipt} onPress={() => setNewExpense({...newExpense, receiptUri: null, fileName: null})}>
                        <Ionicons name="trash" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.previewContainer}>
                      <Text style={{color: 'white', marginBottom: 5}}>{newExpense.fileName}</Text>
                      <TouchableOpacity style={styles.removeReceipt} onPress={() => setNewExpense({...newExpense, receiptUri: null, fileName: null})}>
                        <Ionicons name="trash" size={20} color="white" />
                      </TouchableOpacity>
                    </View>
                  )
                ) : (
                  <TouchableOpacity style={styles.scanBtn} onPress={handleScanReceipt}>
                    <Ionicons name="camera" size={24} color={COLORS.primary} />
                    <Text style={styles.scanText}>Scan Receipt / Upload File</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.saveBtn} onPress={addExpense}>
                  <Text style={styles.saveText}>Save Expense</Text>
                </TouchableOpacity>
              </View>
            )}

            {expenses.map((item) => (
              <TouchableOpacity key={item.id} style={styles.itemRow} onLongPress={() => confirmDelete(item.id, 'expenses')}>
                <View style={styles.iconBox}>
                  <Ionicons name={item.type === 'Gas' ? 'color-fill' : item.type === 'Repair' ? 'build' : 'card'} size={24} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.itemVendor}>{item.vendor}</Text>
                  <Text style={styles.itemDate}>{item.timestamp?.toDate?.().toLocaleDateString() || 'Recent'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.itemAmount}>-${parseFloat(item.amount).toFixed(2)}</Text>
                  {item.receiptUri && (
                    <TouchableOpacity onPress={() => setViewReceipt(item.receiptUri)}>
                      <Ionicons name="document-outline" size={18} color={COLORS.primary} style={{marginTop: 4}} />
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          trips.map((item) => (
            <TouchableOpacity key={item.id} style={styles.itemRow} onLongPress={() => confirmDelete(item.id, 'trips')}>
              <View style={[styles.iconBox, {backgroundColor: '#2A2A2A'}]}>
                <Ionicons name="navigate" size={24} color="#4BC0C0" />
              </View>
              <View style={{ flex: 1, marginLeft: 15 }}>
                <Text style={styles.itemVendor}>{item.type || 'Business'} Trip</Text>
                <Text style={styles.itemDate}>{item.timestamp?.toDate?.().toLocaleDateString() || 'Recent'}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.itemAmount}>${parseFloat(item.savings).toFixed(2)}</Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Modal for viewing receipt */}
      <Modal visible={!!viewReceipt} transparent animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.modalClose} onPress={() => setViewReceipt(null)}>
            <Ionicons name="close" size={30} color="white" />
          </TouchableOpacity>
          {viewReceipt && (isImageUri(viewReceipt) ? (
            <Image source={{ uri: viewReceipt }} style={styles.modalImage} />
          ) : (
            <TouchableOpacity style={styles.modalFileBtn} onPress={() => Sharing.shareAsync(viewReceipt)}>
              <Text style={{color: 'white', fontSize: 18}}>Open File</Text>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, alignItems: 'center', marginVertical: 10 },
  title: { fontSize: 26, fontWeight: 'bold', color: COLORS.text },
  exportBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, backgroundColor: '#EEE' },
  exportText: { marginLeft: 5, fontWeight: '600', color: COLORS.primary },
  balanceCard: { backgroundColor: COLORS.primary, padding: 20, borderRadius: 16, marginHorizontal: 20 },
  balanceLabel: { color: 'white', fontSize: 14 },
  balanceValue: { color: 'white', fontSize: 28, fontWeight: 'bold', marginTop: 5 },
  lastExportText: { color: '#DDD', fontSize: 12, marginTop: 3 },
  chartContainer: { alignItems: 'center', marginVertical: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  tabRow: { flexDirection: 'row', marginHorizontal: 20, marginBottom: 10 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  activeTab: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 16, color: COLORS.text },
  activeTabText: { color: COLORS.primary, fontWeight: 'bold' },
  addBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 20, marginBottom: 10 },
  addBtnText: { marginLeft: 5, fontWeight: 'bold', fontSize: 16 },
  formCard: { backgroundColor: '#333', marginHorizontal: 20, borderRadius: 16, padding: 15 },
  inputRow: { flexDirection: 'row', marginBottom: 10 },
  input: { backgroundColor: '#222', color: 'white', padding: 10, borderRadius: 8 },
  typeRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  typeChip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#555' },
  activeType: { backgroundColor: COLORS.primary },
  typeText: { color: 'white' },
  activeTypeText: { color: 'white', fontWeight: 'bold' },
  scanBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  scanText: { marginLeft: 5, color: COLORS.primary, fontWeight: 'bold' },
  saveBtn: { backgroundColor: COLORS.success, padding: 12, borderRadius: 12, alignItems: 'center' },
  saveText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  itemRow: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 1, borderBottomColor: '#444' },
  iconBox: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#444', justifyContent: 'center', alignItems: 'center' },
  itemVendor: { color: 'white', fontWeight: '600' },
  itemDate: { color: '#888', fontSize: 12 },
  itemAmount: { color: 'white', fontWeight: '600' },
  previewContainer: { marginVertical: 10, position: 'relative', alignItems: 'center' },
  receiptPreview: { width: 100, height: 100, borderRadius: 12 },
  removeReceipt: { position: 'absolute', top: -5, right: -5, backgroundColor: 'red', padding: 4, borderRadius: 12 },
  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center' },
  modalClose: { position: 'absolute', top: 50, right: 20 },
  modalImage: { width: '90%', height: '70%', borderRadius: 16 },
  modalFileBtn: { padding: 20, backgroundColor: COLORS.primary, borderRadius: 16 }
});