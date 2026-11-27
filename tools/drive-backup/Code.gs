/**
 * Εβδομαδιαίο αντίγραφο ασφαλείας της εφαρμογής «Άδειες & Υπερωρίες» στο Google Drive.
 *
 * Τρέχει στον λογαριασμό Google του ιδιοκτήτη (script.google.com), διαβάζει το Firestore
 * με τον λογαριασμό υπηρεσίας του Firebase (κλειδί στην ιδιότητα SA_KEY) και ενημερώνει το adeies-backup.json στον φάκελο «Άδειες» (ένα αρχείο, αντικαθίσταται).
 * Η μορφή είναι ίδια με το «Αντίγραφο ασφαλείας» της εφαρμογής, άρα γίνεται επαναφορά από
 * Ρυθμίσεις → Εισαγωγή ιστορικού.
 *
 * Εγκατάσταση: βάλε το κλειδί στην ιδιότητα σεναρίου SA_KEY και τρέξε μία φορά τη setup() — φτιάχνει το χρονοδιάγραμμα (κάθε Δευτέρα 03:00–04:00)
 * και παίρνει αμέσως ένα πρώτο αντίγραφο.
 */
const PROJECT_ID = "adeies-stratos";
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

// ---------------- Σύνδεση με τον λογαριασμό υπηρεσίας του Firebase ----------------
// Το κλειδί JSON (Firebase → Project settings → Service accounts → Generate new private key)
// αποθηκεύεται στις «Ιδιότητες σεναρίου» με όνομα SA_KEY — όχι μέσα στον κώδικα.
function accessToken() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("saToken");
  if (cached) return cached;
  const raw = PropertiesService.getScriptProperties().getProperty("SA_KEY");
  if (!raw) throw new Error("Λείπει η ιδιότητα SA_KEY (Ρυθμίσεις έργου → Ιδιότητες σεναρίου).");
  const key = JSON.parse(raw);
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o) => Utilities.base64EncodeWebSafe(typeof o === "string" ? o : JSON.stringify(o)).replace(/=+$/, "");
  const head = b64({ alg: "RS256", typ: "JWT" });
  const claims = b64({ iss: key.client_email, scope: "https://www.googleapis.com/auth/datastore",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 });
  const sig = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(head + "." + claims, key.private_key)).replace(/=+$/, "");
  const res = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {
    method: "post", muteHttpExceptions: true,
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: head + "." + claims + "." + sig },
  });
  const body = JSON.parse(res.getContentText());
  if (!body.access_token) throw new Error("Σύνδεση λογαριασμού υπηρεσίας: " + res.getContentText().slice(0, 300));
  cache.put("saToken", body.access_token, 50 * 60);
  return body.access_token;
}

// ---------------- Firestore REST ----------------
function listCollection(name) {
  const base = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/" + name;
  const out = [];
  let token = "";
  do {
    const url = base + "?pageSize=300" + (token ? "&pageToken=" + encodeURIComponent(token) : "");
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: "Bearer " + accessToken() }, muteHttpExceptions: true });
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
