import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getReactNativePersistence, initializeAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
// REMOVED: import { getStorage } ...

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

const db = getFirestore(app);
// REMOVED: const storage = getStorage(app);

// Only export auth and db
export { auth, db };
