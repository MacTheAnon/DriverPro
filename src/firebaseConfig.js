import { initializeApp } from "firebase/app";
// FIXED: Import special persistence tools
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your existing config (Keep your keys exactly as they were!)
const firebaseConfig = {
  apiKey: "AIzaSyDPKxSCMQvzbonJEduiexEvo7WgXlQjzio",
  authDomain: "driverpro-web.firebaseapp.com",
  projectId: "driverpro-web",
  storageBucket: "driverpro-web.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:324508fa5885c34e803529",
  measurementId: "G-9KCB85D8L2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// --- FIXED AUTH INITIALIZATION ---
// This tells Firebase: "Use AsyncStorage to remember the user forever"
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
