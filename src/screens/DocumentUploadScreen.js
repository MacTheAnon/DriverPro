import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { ActivityIndicator, Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import COLORS from '../styles/colors';
// FIXED: Import the Permission Hook
import { usePermissions } from '../hooks/usePermissions';

export default function DocumentUploadScreen({ navigation }) {
  const [insuranceImage, setInsuranceImage] = useState(null);
  const [registrationImage, setRegistrationImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // FIXED: Destructure the camera request from the hook
  const { requestCamera } = usePermissions();

  // 1. Pick Photo (Now uses Hook + Camera for scanning)
  const pickImage = async (type) => {
    // A. Use the Hook to politely ask for permission
    const hasPermission = await requestCamera();
    if (!hasPermission) return;

    // B. Launch Camera (Better for scanning documents than Gallery)
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled) {
        if (type === 'insurance') setInsuranceImage(result.assets[0].uri);
        if (type === 'registration') setRegistrationImage(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Camera Error', error.message);
    }
  };

  // 2. Pick Document (PDF) - Remains the same
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

  // 3. Submit Logic
  const handleSubmit = async () => {
    if (!insuranceImage || !registrationImage) {
      Alert.alert('Missing Documents', 'Please upload both Insurance and Registration to continue.');
      return;
    }

    setIsUploading(true);
    // Simulate network request
    setTimeout(() => {
      setIsUploading(false);
      Alert.alert('Success', 'Documents uploaded successfully!', [
        { text: 'Finish Setup', onPress: () => navigation.replace('Dashboard') }
      ]);
    }, 2000);
  };

  // 4. Card Component
  const UploadCard = ({ title, uri, type }) => {
    const isPdf = uri ? uri.toLowerCase().includes('.pdf') : false;

    return (
      <View style={styles.cardContainer}>
        <Text style={styles.cardTitle}>{title}</Text>
        
        {uri ? (
          <TouchableOpacity style={styles.previewBox} onPress={() => type === 'insurance' ? setInsuranceImage(null) : setRegistrationImage(null)}>
            {isPdf ? (
              <View style={styles.pdfContainer}>
                 <Ionicons name="document-text" size={40} color={COLORS.textSecondary} />
                 <Text style={{color: COLORS.textSecondary, marginTop: 5}}>Document Ready</Text>
              </View>
            ) : (
              <Image source={{ uri: uri }} style={styles.previewImage} />
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
            {/* OPTION 1: Scan with Camera (Uses Hook) */}
            <TouchableOpacity style={styles.optionBtn} onPress={() => pickImage(type)}>
               <Ionicons name="camera" size={28} color={COLORS.primary} />
               <Text style={styles.optionText}>Scan</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* OPTION 2: Upload File */}
            <TouchableOpacity style={styles.optionBtn} onPress={() => pickDocument(type)}>
               <Ionicons name="document-text" size={28} color={COLORS.textSecondary} />
               <Text style={styles.optionText}>PDF/File</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>Verify Your Vehicle</Text>
        <Text style={styles.subtitle}>Upload your documents to activate protection.</Text>
      </View>
      <View style={styles.content}>
        <UploadCard title="Proof of Insurance" uri={insuranceImage} type="insurance" />
        <UploadCard title="Vehicle Registration" uri={registrationImage} type="registration" />
      </View>
      <View style={styles.footer}>
        <TouchableOpacity 
          style={[styles.submitButton, isUploading && styles.disabledButton]} 
          onPress={handleSubmit}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.submitText}>Submit & Continue</Text>
          )}
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