# Άδειες & Υπερωρίες

Web app (κινητό, tablet, υπολογιστής) που αντικαθιστά το Excel «Ιστορικό αδειών/υπερωριών».

| Οθόνη | Τι κάνει | Αντίστοιχο στο Excel |
|---|---|---|
| **Ημερολόγιο** | Μήνας σε πλέγμα. Πατάς μια μέρα → είδος άδειας, ώρες υπερωρίας, σημείωση, ή διάστημα ημερών. Σύνοψη μήνα και **📄 Word** για το υπηρεσιακό σημείωμα υπερωριών. | Σύνολα (κάτω μέρος), Data, TempPrint, κουμπιά |
| **Υπόλοιπα** | Υπόλοιπο ανά είδος και έτος, ρεπό που δόθηκαν, αιμοδοσίες | Σύνολα γρ. 15–18, Parameters (RepoGiven, Blood) |
| **Σύνολα** | Πίνακας μήνες × είδη, υπερωρίες, απουσίες, ημέρες εργασίας· και ανά έτος | Σύνολα, Φύλλο1 |
| **OTS** | Ανέβασμα εξαγωγής OTS και διασταύρωση με όσα έχεις καταχωρήσει | OTS |
| **Ρυθμίσεις** | Είδη (δικαιώματα, τύπος υπολοίπου, αντιστοίχιση OTS), αργίες, πρότυπο Word, εισαγωγή/αντίγραφο | Parameters (DaysOff) |

Κανόνες (ίδιοι με το Excel — ελέγχονται στα tests με τα νούμερα του 2026):
- Μετρούν όλες οι ημέρες εκτός Κυριακής. Απουσίες = είδη με «Απουσία» ✓ (όχι ΑΡΓ/Τηλεργασία).
- Υπερωρία Κυριακής ή ημέρας ΑΡΓ → πίνακας αργίας (07:00–…). Καθημερινή 15:00–…, Σάββατο 07:00–… (ώρες στις Ρυθμίσεις).
- Κανονική: υπόλοιπο έναρξης (43 το 2022) + 25/έτος − χρήση. Ρεπό: σύνολο «Ρεπό που δόθηκαν» − χρήση (Πρόεδρος → Ρεπό Προέδρου).

Διορθώσεις σε σχέση με το Excel: η τελευταία μέρα του μήνα μπαίνει στο σημείωμα· οι ημερομηνίες γράφονται σωστά (όχι μήνας/ημέρα)·
ελέγχεται όλος ο μήνας (όχι μόνο ως τις 19)· το ιστορικό δεν τελειώνει το 2028.

## Εγκατάσταση (μία φορά)

1. Firebase project (Spark αρκεί) με **Authentication → Google** και **Firestore (europe-west1, production mode)**.
2. Στο `public/js/config.js` το `firebaseConfig` του web app και στο `.firebaserc` το project ID.
3. GitHub → Settings → Secrets → Actions: `FIREBASE_SERVICE_ACCOUNT` = όλο το JSON από
   Firebase → Project settings → Service accounts → Generate new private key.
4. Κάθε push στο `main` ανεβαίνει αυτόματα (Actions → Deploy). Χειροκίνητα: Actions → Deploy → Run workflow.
5. Άνοιξε `https://<project-id>.web.app`, σύνδεση με Google, **Ρυθμίσεις → Εισαγωγή ιστορικού** → `history.json`.
6. Στο κινητό: μενού browser → **Προσθήκη στην αρχική οθόνη**.

### Το history.json
Φτιάχνεται από το παλιό Excel και **δεν ανεβαίνει στο GitHub** (φάκελος `data/` στο .gitignore — έχει προσωπικά δεδομένα):
```
pip install openpyxl
python tools/export_history.py "Ιστορικό.xlsm"
```

## Δοκιμή χωρίς Firebase
Αν το `firebaseConfig` είναι κενό ή ανοίξεις με `?demo`, η εφαρμογή δουλεύει με τα δεδομένα μόνο στον browser (localStorage).
Τοπικά: `cd public && python -m http.server 8765` → http://localhost:8765/?demo

## Δομή
```
public/js/logic.js    αργίες, σύνολα, υπόλοιπα, υπερωρίες, διασταύρωση OTS (καθαρή λογική)
public/js/store.js    Firestore / localStorage
public/js/views.js    οθόνες
public/js/docgen.js   σημείωμα υπερωριών (.docx) από public/templates/ypereories.docx
tests/                node tests/logic.test.mjs
tools/                μετατροπή του Excel σε history.json
```
Firestore: `years/{έτος}` {days: {"2026-11-25": {k, o, n}}}, `config/kinds|settings|template`, `repo`, `blood`, `ots/{έτος}`, `ots/meta`.

Προσωπικά στοιχεία (ονοματεπώνυμο, διεύθυνση, τηλέφωνο, υπογράφοντες) και υπογραφή **δεν** υπάρχουν στα δημόσια πρότυπα· τα πρότυπα έχουν πεδία `{{p_…}}` / `{{signature}}` που συμπληρώνονται από το `config/profile` και `config/signature` (μόνο ο ιδιοκτήτης έχει πρόσβαση).

## Αυτόματο αντίγραφο στο Google Drive
`tools/drive-backup/` — Google Apps Script στον λογαριασμό του ιδιοκτήτη. Κάθε Δευτέρα 03:00–04:00 (ώρα Ελλάδας) διαβάζει το Firestore
και γράφει `adeies-backup-ΗΗΗΗ-ΜΜ-ΗΗ_ΩΩΛΛ.json` στον φάκελο «Άδειες» του Drive· κρατά τα 26 πιο πρόσφατα.
Επαναφορά: Ρυθμίσεις → Εισαγωγή ιστορικού → το αρχείο.

Εγκατάσταση: script.google.com → Νέο έργο → επικόλληση `Code.gs` → Ρυθμίσεις έργου → «Εμφάνιση αρχείου appsscript.json» →
επικόλληση `appsscript.json` → εκτέλεση `setup` → έγκριση δικαιωμάτων.
