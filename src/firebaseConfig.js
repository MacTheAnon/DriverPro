import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
// 1. Swap getFirestore for initializeFirestore and import persistentLocalCache
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDPKxSCMQvzbonJEduiexEvo7WgXlQjzio",
  authDomain: "driverpro-web.firebaseapp.com",
  projectId: "driverpro-web",
  storageBucket: "driverpro-web.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:324508fa5885c34e803529",
  measurementId: "G-9KCB85D8L2"
};

const app = initializeApp(firebaseConfig);

// Saves login to the phone's local chip (Free)
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});

// 2. Initialize Firestore with explicit offline caching enabled
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});

export { auth, db };
