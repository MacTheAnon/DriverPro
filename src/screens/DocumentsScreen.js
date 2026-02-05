import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
// ---------------------------------------------------------
// FIX: Use 'legacy' import for copyAsync/documentDirectory
// ---------------------------------------------------------
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Alert, Dimensions, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import COLORS from '../styles/colors';

const { width } = Dimensions.get('window');

export default function DocumentsScreen({ navigation }) {
  const [insuranceImg, setInsuranceImg] = useState(null);
  const [registrationImg, setRegistrationImg] = useState(null);
  const [fullScreenImage, setFullScreenImage] = useState(null);

  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      const ins = await AsyncStorage.getItem('doc_insurance');
      const reg = await AsyncStorage.getItem('doc_registration');
      if (ins) setInsuranceImg(ins);
      if (reg) setRegistrationImg(reg);
    } catch (e) {
      console.log("Error loading docs:", e);
    }
  };

  // --- CHOICE MENU ---
  const handleUploadRequest = (type) => {
    Alert.alert(
      "Upload Document",
      "How would you like to add this document?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Choose from Files", onPress: () => pickFromGallery(type) },
        { text: "Take Photo", onPress: () => openCamera(type) },
      ]
    );
  };

  // 1. Camera Logic
  const openCamera = async (type) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "Camera access is needed to take a photo of your document.");
      return;
    }

    let result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (!result.canceled) {
      saveImagePermanently(result.assets[0].uri, type);
    }
  };

  // 2. Gallery/File Logic
  const pickFromGallery = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "Gallery access is needed to pick a file.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled) {
      saveImagePermanently(result.assets[0].uri, type);
    }
  };

  const saveImagePermanently = async (uri, type) => {
    try {
      const fileName = `${type}_${Date.now()}.jpg`; 
      const newPath = FileSystem.documentDirectory + fileName;

      // This works now because we imported from 'legacy'
      await FileSystem.copyAsync({ from: uri, to: newPath });

      // Save Path
      const key = type === 'insurance' ? 'doc_insurance' : 'doc_registration';
      await AsyncStorage.setItem(key, newPath);

      // Update State
      if (type === 'insurance') setInsuranceImg(newPath);
      else setRegistrationImg(newPath);

    } catch (e) {
      Alert.alert("Error", "Could not save document locally.");
      console.error(e);
    }
  };

  const handleDelete = async (type) => {
    Alert.alert("Delete Document", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          const key = type === 'insurance' ? 'doc_insurance' : 'doc_registration';
          await AsyncStorage.removeItem(key);
          if (type === 'insurance') setInsuranceImg(null);
          else setRegistrationImg(null);
        }
      }
    ]);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.title}>My Documents</Text>
        <Ionicons name="shield-checkmark-outline" size={24} color={COLORS.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.subtitle}>
          Tap to add your Insurance & Registration. Access these offline during traffic stops.
        </Text>

        {/* INSURANCE CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Insurance Card</Text>
            {insuranceImg && (
              <TouchableOpacity onPress={() => handleDelete('insurance')}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
          
          {insuranceImg ? (
            <TouchableOpacity onPress={() => setFullScreenImage(insuranceImg)}>
              <Image source={{ uri: insuranceImg }} style={styles.docImage} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => handleUploadRequest('insurance')}>
              <Ionicons name="camera-outline" size={40} color="#666" />
              <Text style={styles.uploadText}>Tap to Add Insurance</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* REGISTRATION CARD */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Vehicle Registration</Text>
            {registrationImg && (
              <TouchableOpacity onPress={() => handleDelete('registration')}>
                <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
              </TouchableOpacity>
            )}
          </View>
          
          {registrationImg ? (
            <TouchableOpacity onPress={() => setFullScreenImage(registrationImg)}>
              <Image source={{ uri: registrationImg }} style={styles.docImage} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => handleUploadRequest('registration')}>
              <Ionicons name="camera-outline" size={40} color="#666" />
              <Text style={styles.uploadText}>Tap to Add Registration</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* FULL SCREEN MODAL */}
      <Modal visible={!!fullScreenImage} transparent={true} animationType="fade">
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={() => setFullScreenImage(null)}>
            <Ionicons name="close-circle" size={50} color="white" />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image source={{ uri: fullScreenImage }} style={styles.fullImage} resizeMode="contain" />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 60, backgroundColor: '#1E1E1E' },
  backBtn: { padding: 5 },
  title: { fontSize: 20, fontWeight: 'bold', color: 'white' },
  scroll: { padding: 20 },
  subtitle: { color: '#888', textAlign: 'center', marginBottom: 20 },
  
  card: { backgroundColor: '#1E1E1E', borderRadius: 15, padding: 15, marginBottom: 20, borderWidth: 1, borderColor: '#333' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 },
  cardTitle: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  
  uploadPlaceholder: { height: 200, backgroundColor: '#121212', borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#444', justifyContent: 'center', alignItems: 'center' },
  uploadText: { color: '#666', marginTop: 10 },
  
  docImage: { width: '100%', height: 200, borderRadius: 10, resizeMode: 'cover' },

  modalContainer: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  fullImage: { width: '100%', height: '80%' },
  closeBtn: { position: 'absolute', top: 50, right: 20, zIndex: 10 }
});