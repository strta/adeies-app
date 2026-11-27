/**
 * Εβδομαδιαίο αντίγραφο ασφαλείας της εφαρμογής «Άδειες & Υπερωρίες» στο Google Drive.
 *
 * Τρέχει στον λογαριασμό Google του ιδιοκτήτη (script.google.com), διαβάζει το Firestore
 * με τα δικά του δικαιώματα και ενημερώνει το adeies-backup.json στον φάκελο «Άδειες» (ένα αρχείο, αντικαθίσταται).
 * Η μορφή είναι ίδια με το «Αντίγραφο ασφαλείας» της εφαρμογής, άρα γίνεται επαναφορά από
 * Ρυθμίσεις → Εισαγωγή ιστορικού.
 *
 * Εγκατάσταση: τρέξε μία φορά τη setup() — φτιάχνει το χρονοδιάγραμμα (κάθε Δευτέρα 03:00–04:00)
 * και παίρνει αμέσως ένα πρώτο αντίγραφο.
 */
const PROJECT_ID = "adeies-stratos";
const API_KEY = "AIzaSyCf4JHql6e_GChdHVkL0p4tW2QfyXNhA0c"; // δημόσιο κλειδί web app (ίδιο με public/js/config.js)
const FOLDER_ID = "1az89jWXszVd9A-qRNl4GaAetmksWX8Zp"; // φάκελος «Άδειες»
const FILE_NAME = "adeies-backup.json";               // ένα αρχείο, αντικαθίσταται κάθε φορά

function setup() {
  ScriptApp.getProjectTriggers()
    .filter((t) => t.getHandlerFunction() === "backup")
    .forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger("backup").timeBased()
    .onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(3).inTimezone("Europe/Athens").create();
  backup();
  Logger.log("Έτοιμο: αντίγραφο κάθε Δευτέρα 03:00–04:00 (ώρα Ελλάδας).");
}

function backup() {
  const col = (name) => listCollection(name);
  const config = Object.fromEntries(col("config").map((d) => [d.id, d.data]));
  const days = {};
  col("years").forEach((d) => Object.assign(days, d.data.days || {}));
  const ots = col("ots").filter((d) => d.id !== "meta").flatMap((d) => d.data.rows || []);
  const strip = (d) => d.data;

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "drive-backup",
    settings: config.settings || {},
    kinds: (config.kinds && config.kinds.list) || [],
    profile: config.profile || {},
    signature: config.signature && config.signature.b64 ? config.signature : null,
    repo: col("repo").map(strip),
    blood: col("blood").map(strip),
    days: days,
    ots: ots,
  };
  if (!Object.keys(days).length) throw new Error("Το Firestore επέστρεψε 0 ημέρες — δεν γράφτηκε αντίγραφο.");

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const json = JSON.stringify(data, null, 1);
  const it = folder.getFilesByName(FILE_NAME);
  const file = it.hasNext() ? it.next() : null;
  if (file) file.setContent(json); else folder.createFile(FILE_NAME, json, "application/json");
  Logger.log("Ενημερώθηκε το %s (%s ημέρες, %s KB)", FILE_NAME, Object.keys(days).length, Math.round(json.length / 1024));
}

// ---------------- Σύνδεση ως ο ιδιοκτήτης (Firebase Auth με τον λογαριασμό Google) ----------------
// Έτσι ισχύουν κανονικά οι κανόνες ασφαλείας του Firestore (μόνο το email του ιδιοκτήτη).
function firebaseToken() {
  const cache = CacheService.getUserCache();
  const cached = cache.get("fbToken");
  if (cached) return cached;
  const res = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=" + API_KEY, {
    method: "post", contentType: "application/json", muteHttpExceptions: true,
    payload: JSON.stringify({
      postBody: "access_token=" + ScriptApp.getOAuthToken() + "&providerId=google.com",
      requestUri: "http://localhost", returnSecureToken: true, returnIdpCredential: true,
    }),
  });
  const body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200 || !body.idToken) throw new Error("Σύνδεση Firebase: " + res.getResponseCode() + " " + res.getContentText().slice(0, 300));
  cache.put("fbToken", body.idToken, 50 * 60); // ισχύει 1 ώρα
  return body.idToken;
}

// ---------------- Firestore REST ----------------
function listCollection(name) {
  const base = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/" + name;
  const out = [];
  let token = "";
  do {
    const url = base + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + firebaseToken() }, muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error("Firestore " + name + ": " + res.getResponseCode() + " " + res.getContentText().slice(0, 300));
    const body = JSON.parse(res.getContentText());
    (body.documents || []).forEach((d) => out.push({ id: d.name.split("/").pop(), data: fields(d.fields || {}) }));
    token = body.nextPageToken || "";
  } while (token);
  return out;
}
function fields(f) {
  const o = {};
  Object.keys(f).forEach((k) => { o[k] = value(f[k]); });
  return o;
}
function value(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("nullValue" in v) return null;
  if ("timestampValue" in v) return v.timestampValue;
  if ("mapValue" in v) return fields(v.mapValue.fields || {});
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(value);
  if ("referenceValue" in v) return v.referenceValue;
  if ("bytesValue" in v) return v.bytesValue;
  if ("geoPointValue" in v) return v.geoPointValue;
  return null;
}
