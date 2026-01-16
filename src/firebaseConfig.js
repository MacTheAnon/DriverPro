import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAV9K2NLCBWhOGoKXmU0X1_PhqZycYrU3c",
  authDomain: "driverpro-web.firebaseapp.com",
  projectId: "driverpro-web",
  storageBucket: "driverpro-web.firebasestorage.app",
  messagingSenderId: "1083485928900",
  appId: "1:1083485928900:web:9dd3ca3fd0e09d564db891",
  measurementId: "G-J8MPPG1SS0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services for use in your screens
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);