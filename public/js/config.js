// Ο μοναδικός λογαριασμός με πρόσβαση (ίδιο με firestore.rules)
export const OWNER_EMAIL = "stratos.tampakis@gmail.com";

// Firebase web config (δημόσια στοιχεία — η προστασία γίνεται από τα Firestore rules).
// Αν είναι κενό, η εφαρμογή ανοίγει σε «δοκιμαστική λειτουργία» με τα δεδομένα μόνο σε αυτόν τον browser.
export const firebaseConfig = {
  apiKey: "AIzaSyCf4JHql6e_GChdHVkL0p4tW2QfyXNhA0c",
  authDomain: "adeies-stratos.firebaseapp.com",
  projectId: "adeies-stratos",
  storageBucket: "adeies-stratos.firebasestorage.app",
  messagingSenderId: "602066675905",
  appId: "1:602066675905:web:3025fafc17b3a105084c40",
};
