import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";

// FIXED: I put your REAL key here (ending in Qjzio)
const firebaseConfig = {
  apiKey: "AIzaSyDPKxSCMQvzbonJEduiexEvo7WgXlQjzio",
  authDomain: "driverpro-web.firebaseapp.com",
  projectId: "driverpro-web",
  storageBucket: "driverpro-web.firebasestorage.app",
  messagingSenderId: "563584335869",
  appId: "1:563584335869:web:324508fa5885c34e803529",
  measurementId: "G-9KCB85D8L2"
};

// Initialize App
const app = initializeApp(firebaseConfig);

// Use simple Auth so you don't need a rebuild right now
const auth = getAuth(app);

const db = getFirestore(app);

export { auth, db };

