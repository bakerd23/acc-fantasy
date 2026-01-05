import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDxk3T_7oF_ObNbw97fj9GnUj5f4fTaqgU",
  authDomain: "acc-fantasy-667a8.firebaseapp.com",
  projectId: "acc-fantasy-667a8",
  storageBucket: "acc-fantasy-667a8.firebasestorage.app",
  messagingSenderId: "938894260054",
  appId: "1:938894260054:web:4748ebc7fbeaf254c808f7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };