import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
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

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert("Permission Denied", "We need access to your photos to save your documents.");
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 1,
    });

    if (!result.canceled) {
      saveImagePermanently(result.assets[0].uri, type);
    }
  };

  const saveImagePermanently = async (uri, type) => {
    try {
      const fileName = `${type}.jpg`;
      const newPath = FileSystem.documentDirectory + fileName;

      await FileSystem.copyAsync({ from: uri, to: newPath });

      const key = type === 'insurance' ? 'doc_insurance' : 'doc_registration';
      await AsyncStorage.setItem(key, newPath);

      if (type === 'insurance') setInsuranceImg(newPath);
      else setRegistrationImg(newPath);

      Alert.alert("Saved", "Document secure and ready for offline use.");
    } catch (e) {
      Alert.alert("Error", "Could not save document locally.");
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
          Keep these updated for traffic stops. Photos are stored locally on your device.
        </Text>

        {/* INSURANCE */}
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
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('insurance')}>
              <Ionicons name="camera-outline" size={40} color="#666" />
              <Text style={styles.uploadText}>Tap to Upload Insurance</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* REGISTRATION */}
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
            <TouchableOpacity style={styles.uploadPlaceholder} onPress={() => pickImage('registration')}>
              <Ionicons name="camera-outline" size={40} color="#666" />
              <Text style={styles.uploadText}>Tap to Upload Registration</Text>
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