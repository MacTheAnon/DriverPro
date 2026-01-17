import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

// Your verified config
const firebaseConfig = {
  apiKey: "AIzaSyD...", // Keep your existing keys!
  authDomain: "driverpro-web.firebaseapp.com",
  projectId: "driverpro-web",
  storageBucket: "driverpro-web.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:324508fa5885c34e803529",
  measurementId: "G-9KCB85D8L2"
};

// Initialize App
const app = initializeApp(firebaseConfig);

// FIXED: Use initializeAuth with persistence instead of getAuth()
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

const db = getFirestore(app);

export { auth, db };
