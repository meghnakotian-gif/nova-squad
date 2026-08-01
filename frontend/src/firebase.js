// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase configuration parameters provided by the user
const firebaseConfig = {
  apiKey: "AIzaSyA568rBO5Y1vFPgKY7y3dGiSq7d06yEwCo",
  authDomain: "floodpulseai.firebaseapp.com",
  projectId: "floodpulseai",
  storageBucket: "floodpulseai.firebasestorage.app",
  messagingSenderId: "323792074053",
  appId: "1:323792074053:web:ee0cb1754cf03193bf3a2c"
};

// Initialize Firebase Application context
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore database instance and export it
export const db = getFirestore(app);

// Initialize Firebase Authentication instance and export it
export const auth = getAuth(app);
