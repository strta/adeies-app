// Ο μοναδικός λογαριασμός με πρόσβαση (ίδιο με firestore.rules)
export const OWNER_EMAIL = "stratos.tampakis@gmail.com";

// Firebase web config (δημόσια στοιχεία — η προστασία γίνεται από τα Firestore rules).
// Αν είναι κενό, η εφαρμογή ανοίγει σε «δοκιμαστική λειτουργία» με τα δεδομένα μόνο σε αυτόν τον browser.
export const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};
