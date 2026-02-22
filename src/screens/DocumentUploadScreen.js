import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { doc, setDoc } from 'firebase/firestore';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebaseConfig';
import { usePermissions } from '../hooks/usePermissions';
import COLORS from '../styles/colors';

// FIX: Defined outside component so React doesn't recreate/remount on every render
const UploadCard = ({ title, uri, type, onPickImage, onPickDocument, onClear }) => {
  const isPdf = uri ? uri.toLowerCase().includes('.pdf') : false;
  return (
    <View style={styles.cardContainer}>
      <Text style={styles.cardTitle}>{title}</Text>
      {uri ? (
        <TouchableOpacity style={styles.previewBox} onPress={onClear}>
          {isPdf ? (
            <View style={styles.pdfContainer}>
              <Ionicons name="document-text" size={40} color={COLORS.textSecondary} />
              <Text style={{ color: COLORS.textSecondary, marginTop: 5 }}>Document Ready</Text>
            </View>
          ) : (
            <Image source={{ uri }} style={styles.previewImage} />
          )}
          <View style={styles.removeBadge}>
            <Ionicons name="close" size={16} color="white" />
          </View>
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={COLORS.success} />
          </View>
        </TouchableOpacity>
      ) : (
        <View style={styles.selectionRow}>
          <TouchableOpacity style={styles.optionBtn} onPress={onPickImage}>
            <Ionicons name="camera" size={28} color={COLORS.primary} />
            <Text style={styles.optionText}>Scan</Text>
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity style={styles.optionBtn} onPress={onPickDocument}>
            <Ionicons name="document-text" size={28} color={COLORS.textSecondary} />
            <Text style={styles.optionText}>PDF/File</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export default function DocumentUploadScreen({ navigation }) {
  const [insuranceImage, setInsuranceImage] = useState(null);
  const [registrationImage, setRegistrationImage] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const { requestCamera } = usePermissions();

  const pickImage = async (type) => {
    const hasPermission = await requestCamera();
    if (!hasPermission) return;
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.7,
      });
      if (!result.canceled) {
        if (type === 'insurance') setInsuranceImage(result.assets[0].uri);
        if (type === 'registration') setRegistrationImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Camera Error', error.message);
    }
  };

  const pickDocument = async (type) => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });
      if (!result.canceled) {
        if (type === 'insurance') setInsuranceImage(result.assets[0].uri);
        if (type === 'registration') setRegistrationImage(result.assets[0].uri);
      }
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const saveToDevice = async (uri, baseFileName) => {
    try {
      // FIX: preserve actual file extension instead of hardcoding .jpg (PDFs were saved as .jpg)
      const uriLower = uri.toLowerCase();
      const ext = uriLower.includes('.pdf') ? '.pdf' : '.jpg';
      const newPath = FileSystem.documentDirectory + baseFileName + ext;
      await FileSystem.copyAsync({ from: uri, to: newPath });
      return newPath;
    } catch (e) {
      console.error('Local Save Error:', e);
      throw new Error(`Could not save file: ${e.message}`);
    }
  };

  const handleSubmit = async () => {
    if (!insuranceImage || !registrationImage) {
      Alert.alert('Missing Documents', 'Please upload both Insurance and Registration to continue.');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Error', 'You must be logged in.');
      return;
    }

    setIsSaving(true);
    try {
      const insPath = await saveToDevice(insuranceImage, `insurance_${user.uid}_${Date.now()}`);
      const regPath = await saveToDevice(registrationImage, `registration_${user.uid}_${Date.now()}`);

      await setDoc(doc(db, 'users', user.uid), {
        documents: {
          insuranceLocalUri: insPath,
          registrationLocalUri: regPath,
          storageType: 'local',
          uploadedAt: new Date().toISOString(),
        },
        documentStatus: 'Verified',
      }, { merge: true });

      Alert.alert('Success', 'Documents saved to device securely.', [
        { text: 'Finish Setup', onPress: () => navigation.replace('Dashboard') },
      ]);
    } catch (error) {
      console.error(error);
      Alert.alert('Save Failed', `Could not save documents: ${error.message}`);
    } finally {
      // FIX: always reset saving state, even if an error was thrown mid-save
      setIsSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Verify Your Vehicle</Text>
        <Text style={styles.subtitle}>Save your documents securely on this device.</Text>
      </View>
      <View style={styles.content}>
        <UploadCard
          title="Proof of Insurance"
          uri={insuranceImage}
          type="insurance"
          onPickImage={() => pickImage('insurance')}
          onPickDocument={() => pickDocument('insurance')}
          onClear={() => setInsuranceImage(null)}
        />
        <UploadCard
          title="Vehicle Registration"
          uri={registrationImage}
          type="registration"
          onPickImage={() => pickImage('registration')}
          onPickDocument={() => pickDocument('registration')}
          onClear={() => setRegistrationImage(null)}
        />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitButton, isSaving && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isSaving}
        >
          {isSaving ? <ActivityIndicator color="white" /> : <Text style={styles.submitText}>Save & Continue</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 20 },
  header: { marginTop: 20, marginBottom: 30 },
  title: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  subtitle: { fontSize: 16, color: '#AAA', lineHeight: 22 },
  content: { flex: 1 },
  cardContainer: { marginBottom: 30 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginBottom: 10, marginLeft: 5 },
  selectionRow: {
    height: 120,
    backgroundColor: COLORS.card,
    borderRadius: 15,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden'
  },
  optionBtn: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.card },
  optionText: { color: COLORS.textSecondary, marginTop: 8, fontWeight: '600' },
  divider: { width: 1, height: '60%', backgroundColor: '#333', alignSelf: 'center' },
  previewBox: {
    height: 150,
    backgroundColor: COLORS.card,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: COLORS.success,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden'
  },
  previewImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  pdfContainer: { alignItems: 'center' },
  checkmark: { position: 'absolute', top: 10, left: 10, backgroundColor: 'white', borderRadius: 12 },
  removeBadge: { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', padding: 5, borderRadius: 15 },
  footer: { marginBottom: 20 },
  submitButton: {
    backgroundColor: COLORS.primary,
    height: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  disabledButton: { opacity: 0.7 },
  submitText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});