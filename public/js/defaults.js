// Προεπιλεγμένα είδη (από το παλιό Excel). Αλλάζουν από τις Ρυθμίσεις.
export const DEFAULT_KINDS = [
 {
  "code": "ΑΔΕ",
  "name": "Άδεια",
  "rights": 25,
  "balance": "carry",
  "ots": [
   "Κανονική"
  ],
  "absence": true,
  "color": "#2e7d32",
  "order": 1
 },
 {
  "code": "ΑΙΜ",
  "name": "Αιμοδοτική",
  "rights": 0,
  "balance": "blood",
  "ots": [
   "Αιμοδοτική Διοικητικών"
  ],
  "absence": true,
  "color": "#ad1457",
  "order": 2
 },
 {
  "code": "ΑΡΓ",
  "name": "Αργία",
  "rights": 0,
  "balance": "none",
  "ots": [],
  "absence": false,
  "color": "#c62828",
  "order": 3
 },
 {
  "code": "ΑΣΘ",
  "name": "Ασθένεια",
  "rights": 6,
  "balance": "annual",
  "ots": [
   "Αναρρωτική Θερ. Ιατρού"
  ],
  "absence": true,
  "color": "#ef6c00",
  "order": 4
 },
 {
  "code": "ΑΣCOV",
  "name": "Ασθένεια Covid",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Καραντίνα"
  ],
  "absence": true,
  "color": "#8d6e63",
  "order": 5
 },
 {
  "code": "ΑΣΘΜ",
  "name": "Ασθένεια μακροχρόνια",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Αναρρωτική Μακροχρόνια"
  ],
  "absence": true,
  "color": "#a1887f",
  "order": 6
 },
 {
  "code": "ΑΣΘΤΚΝ",
  "name": "Ασθένεια Τέκνου",
  "rights": 4,
  "balance": "annual",
  "ots": [
   "Άδεια Ασθενείας Τέκνου (άρθρο 31 Ν.4440/2016)"
  ],
  "absence": true,
  "color": "#d84315",
  "order": 7
 },
 {
  "code": "ΑΣΘΥ",
  "name": "Ασθένεια (Υπ. Δήλωση)",
  "rights": 2,
  "balance": "annual",
  "ots": [
   "Αναρρωτική Υπεύθυνη Δήλωση"
  ],
  "absence": true,
  "color": "#f9a825",
  "order": 8
 },
 {
  "code": "ΓΟΝ",
  "name": "Γονική",
  "rights": 4,
  "balance": "annual",
  "ots": [
   "Σχολική Άδεια 4 Ημ.",
   "Σχολική Άδεια 5 Ημ.",
   "Σχολική Άδεια 6 Ημ."
  ],
  "absence": true,
  "color": "#00838f",
  "order": 9
 },
 {
  "code": "ΔΙΚ",
  "name": "Δικαστική",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Δικαστική"
  ],
  "absence": true,
  "color": "#6d4c41",
  "order": 10
 },
 {
  "code": "ΔΙΩ",
  "name": "Δίωρη",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Δίωρη για προσωπικούς λόγους"
  ],
  "absence": true,
  "color": "#5c6bc0",
  "order": 11
 },
 {
  "code": "ΘΝΤ",
  "name": "Θανάτου",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Θανάτου"
  ],
  "absence": true,
  "color": "#424242",
  "order": 12
 },
 {
  "code": "ΜΟΝ",
  "name": "Μονόωρη",
  "rights": 0,
  "balance": "none",
  "ots": [],
  "absence": true,
  "color": "#7986cb",
  "order": 13
 },
 {
  "code": "ΡΕΠ",
  "name": "Ρεπό",
  "rights": 0,
  "balance": "repo",
  "ots": [
   "Ρεπό"
  ],
  "absence": true,
  "color": "#1565c0",
  "order": 14
 },
 {
  "code": "ΡΕΠΠ",
  "name": "Ρεπό Προέδρου",
  "rights": 0,
  "balance": "repoP",
  "ots": [
   "Εορταστικό Ρεπό"
  ],
  "absence": true,
  "color": "#6a1b9a",
  "order": 15
 },
 {
  "code": "ΣΕΜ",
  "name": "Σεμινάριο",
  "rights": 16,
  "balance": "annual",
  "ots": [
   "Εκπαιδευτική Άδεια (Άδεια Επιμόρφωσης)"
  ],
  "absence": true,
  "color": "#00695c",
  "order": 16
 },
 {
  "code": "ΣΗΜ",
  "name": "Σημαία",
  "rights": 0,
  "balance": "none",
  "ots": [],
  "absence": true,
  "color": "#455a64",
  "order": 17
 },
 {
  "code": "ΤΗΛ",
  "name": "Τηλεργασία",
  "rights": 0,
  "balance": "none",
  "ots": [],
  "absence": false,
  "color": "#546e7a",
  "order": 18
 },
 {
  "code": "ΥΠΔΙΩ",
  "name": "Υπηρεσιακή δίωρη",
  "rights": 0,
  "balance": "none",
  "ots": [
   "Δίωρη για υπηρεσιακούς λόγους"
  ],
  "absence": true,
  "color": "#3949ab",
  "order": 19
 }
];

export const DEFAULT_SETTINGS = { leaveStartYear: 2022, leaveCarry: 43, otWorkStart: "15:00", otHolStart: "07:00", shortLeaveLimit: 4 };
