// Δεδομένα: Firestore (κανονικά) ή localStorage (δοκιμαστική λειτουργία, όταν δεν υπάρχει firebaseConfig ή με ?demo).
import { firebaseConfig, OWNER_EMAIL } from "./config.js";
import { parts } from "./logic.js";

export const DEMO = !firebaseConfig.apiKey || new URLSearchParams(location.search).has("demo");

export const state = {
  user: null, ready: false,
  days: {},          // { "2026-11-25": { k, o, n } } — όλα τα έτη μαζί
  years: {},         // { 2026: {...} } ίδια δεδομένα ανά έτος (όπως αποθηκεύονται)
  kinds: [], settings: {}, repo: [], blood: [], ots: [], otsMeta: null, template: null, signature: null, profile: {},
};

const listeners = new Set();
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
let scheduled = false;
function notify() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => { scheduled = false; listeners.forEach((fn) => fn()); });
}
function rebuildDays() {
  state.days = Object.assign({}, ...Object.values(state.years));
}
const byDate = (a, b) => (b.date || "").localeCompare(a.date || "");
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// =====================================================================================
// Backend: Firestore
// =====================================================================================
let fb = null;
async function firebaseBackend() {
  const V = "10.12.2";
  const appMod = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-app.js`);
  const authMod = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-auth.js`);
  const fs = await import(`https://www.gstatic.com/firebasejs/${V}/firebase-firestore.js`);
  const app = appMod.initializeApp(firebaseConfig);
  const auth = authMod.getAuth(app);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const unsubs = [];
  function listen() {
    const loaded = new Set();
    const done = (k) => { loaded.add(k); if (loaded.size >= 4) state.ready = true; notify(); };
    unsubs.push(fs.onSnapshot(fs.collection(db, "years"), (snap) => {
      state.years = {};
      snap.docs.forEach((d) => { state.years[d.id] = d.data().days || {}; });
      rebuildDays(); done("years");
    }, (e) => console.error("years", e)));
    unsubs.push(fs.onSnapshot(fs.collection(db, "config"), (snap) => {
      const m = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]));
      state.kinds = (m.kinds?.list || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
      state.settings = m.settings || {};
      state.template = m.template || null;
      state.signature = m.signature?.b64 ? m.signature : null;
      state.profile = m.profile || {};
      done("config");
    }, (e) => console.error("config", e)));
    unsubs.push(fs.onSnapshot(fs.collection(db, "repo"), (snap) => {
      state.repo = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDate); done("repo");
    }));
    unsubs.push(fs.onSnapshot(fs.collection(db, "blood"), (snap) => {
      state.blood = snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(byDate); notify();
    }));
    unsubs.push(fs.onSnapshot(fs.collection(db, "ots"), (snap) => {
      state.ots = snap.docs.filter((d) => d.id !== "meta").flatMap((d) => d.data().rows || []);
      state.otsMeta = snap.docs.find((d) => d.id === "meta")?.data() || null;
      done("ots");
    }));
  }
  return {
    onAuth(cb) {
      authMod.onAuthStateChanged(auth, (user) => {
        unsubs.splice(0).forEach((u) => u());
        if (user && user.email === OWNER_EMAIL) { state.user = user; listen(); }
        else { state.user = null; if (user) authMod.signOut(auth); }
        cb(user);
      });
    },
    async login() {
      const p = new authMod.GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      try { await authMod.signInWithPopup(auth, p); } catch (e) {
        if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") await authMod.signInWithRedirect(auth, p);
        else throw e;
      }
    },
    logout: () => authMod.signOut(auth),
    putYear: (y, days) => fs.setDoc(fs.doc(db, "years", String(y)), { days, updatedAt: fs.serverTimestamp() }),
    putConfig: (id, data, merge = false) => fs.setDoc(fs.doc(db, "config", id), data, { merge }),
    putItem: (col, id, data) => fs.setDoc(fs.doc(db, col, id), data),
    delItem: (col, id) => fs.deleteDoc(fs.doc(db, col, id)),
    async putOts(byYear, meta) {
      const batch = fs.writeBatch(db);
      Object.entries(byYear).forEach(([y, rows]) => batch.set(fs.doc(db, "ots", y), { rows }));
      batch.set(fs.doc(db, "ots", "meta"), { ...meta, importedAt: new Date().toISOString() });
      await batch.commit();
    },
  };
}

// =====================================================================================
// Backend: localStorage (δοκιμαστική λειτουργία)
// =====================================================================================
const LS = "adeies-demo-v1";
function demoBackend() {
  const load = () => { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } };
  let db = load();
  const save = () => { try { localStorage.setItem(LS, JSON.stringify(db)); } catch (e) { console.warn(e); } };
  const apply = () => {
    state.years = db.years || {};
    rebuildDays();
    state.kinds = (db.config?.kinds?.list || []).slice().sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
    state.settings = db.config?.settings || {};
    state.template = db.config?.template || null;
    state.signature = db.config?.signature?.b64 ? db.config.signature : null;
    state.profile = db.config?.profile || {};
    state.repo = Object.entries(db.repo || {}).map(([id, d]) => ({ id, ...d })).sort(byDate);
    state.blood = Object.entries(db.blood || {}).map(([id, d]) => ({ id, ...d })).sort(byDate);
    state.ots = Object.values(db.ots || {}).flat();
    state.otsMeta = db.otsMeta || null;
    state.ready = true;
    notify();
  };
  const w = (fn) => { fn(); save(); apply(); return Promise.resolve(); };
  return {
    onAuth(cb) { state.user = { email: "δοκιμή", displayName: "Δοκιμαστική λειτουργία" }; apply(); cb(state.user); },
    login: async () => {}, logout: async () => { localStorage.removeItem(LS); location.reload(); },
    putYear: (y, days) => w(() => { (db.years ||= {})[y] = days; }),
    putConfig: (id, data, merge = false) => w(() => { db.config ||= {}; db.config[id] = merge ? { ...db.config[id], ...data } : data; }),
    putItem: (col, id, data) => w(() => { (db[col] ||= {})[id] = data; }),
    delItem: (col, id) => w(() => { delete db[col]?.[id]; }),
    putOts: (byYear, meta) => w(() => { db.ots = { ...(db.ots || {}), ...byYear }; db.otsMeta = { ...meta, importedAt: new Date().toISOString() }; }),
  };
}

// =====================================================================================
// Δημόσιο API
// =====================================================================================
export async function onAuth(cb) {
  fb = DEMO ? demoBackend() : await firebaseBackend();
  fb.onAuth(cb);
}
export const login = () => fb.login();
export const logout = () => fb.logout();

/** Αλλαγή πολλών ημερών: { iso: entry | null } */
export async function setDays(changes) {
  const touched = {};
  for (const [iso, entry] of Object.entries(changes)) {
    const y = parts(iso)[0];
    const yd = (touched[y] ||= { ...(state.years[y] || {}) });
    const clean = entry && Object.fromEntries(Object.entries(entry).filter(([, v]) => v !== "" && v !== null && v !== undefined && v !== 0));
    if (clean && Object.keys(clean).length) yd[iso] = clean; else delete yd[iso];
  }
  // άμεση εμφάνιση (το Firestore θα επιβεβαιώσει)
  Object.assign(state.years, touched); rebuildDays(); notify();
  await Promise.all(Object.entries(touched).map(([y, d]) => fb.putYear(y, d)));
}
export const setDay = (iso, entry) => setDays({ [iso]: entry });

export const saveKinds = (list) => fb.putConfig("kinds", { list });
export const saveSettings = (data) => fb.putConfig("settings", data, true);
export const saveTemplate = (data) => fb.putConfig("template", data);
export const saveSignature = (data) => fb.putConfig("signature", data);
export const saveProfile = (data) => fb.putConfig("profile", data);
export const saveRepo = (r) => fb.putItem("repo", r.id || newId(), { date: r.date, signer: r.signer || "", reason: r.reason || "", days: Number(r.days) || 0, kind: r.kind || "ΡΕΠ" });
export const deleteRepo = (id) => fb.delItem("repo", id);
export const saveBlood = (r) => fb.putItem("blood", r.id || newId(), { date: r.date, days: Number(r.days) || 0, note: r.note || "" });
export const deleteBlood = (id) => fb.delItem("blood", id);

/** Αντικαθιστά το ιστορικό OTS για τα έτη που περιέχει το αρχείο. */
export async function importOts(rows, fileName) {
  const byYear = {};
  rows.forEach((r) => { (byYear[r.from.slice(0, 4)] ||= []).push(r); });
  await fb.putOts(byYear, { file: fileName || "", count: rows.length });
  return Object.keys(byYear).length;
}

/** Πρώτη εισαγωγή από data/history.json (tools/export_history.py) */
export async function importHistory(h) {
  if (h.kinds?.length) await saveKinds(h.kinds);
  if (h.settings) await saveSettings(h.settings);
  if (h.profile) await saveProfile(h.profile);
  if (h.signature?.b64) await saveSignature(h.signature);
  // σταθερά ids ώστε μια δεύτερη εισαγωγή να μη δημιουργεί διπλά
  for (const [i, r] of (h.repo || []).entries()) await saveRepo({ ...r, id: `h${i}-${r.date}` });
  for (const [i, r] of (h.blood || []).entries()) await saveBlood({ ...r, id: `h${i}-${r.date}` });
  const years = {};
  for (const [iso, e] of Object.entries(h.days || {})) (years[iso.slice(0, 4)] ||= {})[iso] = e;
  for (const [y, d] of Object.entries(years)) await fb.putYear(y, { ...(state.years[y] || {}), ...d });
  if (h.ots?.length) await importOts(h.ots, h.source || "history.json");
  return Object.keys(h.days || {}).length;
}

/** Πλήρες αντίγραφο ασφαλείας (ίδια μορφή με το history.json) */
export function backupData() {
  return {
    version: 1, exportedAt: new Date().toISOString(), settings: state.settings, kinds: state.kinds, profile: state.profile, signature: state.signature,
    repo: state.repo.map(({ id, ...r }) => r), blood: state.blood.map(({ id, ...r }) => r), days: state.days, ots: state.ots,
  };
}
