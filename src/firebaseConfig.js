import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
// ADDED: Import Storage
import { getStorage } from "firebase/storage";

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
const auth = getAuth(app);
const db = getFirestore(app);
// ADDED: Initialize Storage
const storage = getStorage(app);

export { auth, db, storage };
