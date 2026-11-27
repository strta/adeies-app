// Καθαρή λογική (χωρίς Firebase/DOM): ημερομηνίες, αργίες, σύνολα, υπόλοιπα, υπερωρίες, OTS.
// Χρησιμοποιείται και από τα tests (node tests/logic.test.mjs).

export const MONTHS = ["Ιανουάριος", "Φεβρουάριος", "Μάρτιος", "Απρίλιος", "Μάιος", "Ιούνιος", "Ιούλιος",
  "Αύγουστος", "Σεπτέμβριος", "Οκτώβριος", "Νοέμβριος", "Δεκέμβριος"];
/** Αιτιατική, όπως γράφεται στο σημείωμα («κατά τον μήνα Νοέμβριο») */
export const MONTHS_ACC = ["Ιανουάριο", "Φεβρουάριο", "Μάρτιο", "Απρίλιο", "Μάιο", "Ιούνιο", "Ιούλιο",
  "Αύγουστο", "Σεπτέμβριο", "Οκτώβριο", "Νοέμβριο", "Δεκέμβριο"];
export const WEEKDAYS = ["Κυρ", "Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ"];

export const pad = (n) => String(n).padStart(2, "0");
export const isoOf = (y, m, d) => `${y}-${pad(m)}-${pad(d)}`;
export const parts = (iso) => iso.split("-").map(Number);
export const daysInMonth = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();
/** 0 = Κυριακή … 6 = Σάββατο */
export function weekday(iso) {
  const [y, m, d] = parts(iso);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}
export function addDays(iso, n) {
  const [y, m, d] = parts(iso);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return isoOf(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}
export const dmy = (iso) => { const [y, m, d] = parts(iso); return `${pad(d)}/${pad(m)}/${y}`; };
export function todayIso() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Athens" });
}
export function* eachDay(from, to) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

// ---------- Αργίες ----------
/** Ορθόδοξο Πάσχα (Meeus, Ιουλιανό + 13 ημέρες) */
export function orthodoxEaster(y) {
  const a = y % 19, b = y % 4, c = y % 7;
  const d = (19 * a + 15) % 30;
  const e = (2 * b + 4 * c + 6 * d + 6) % 7;
  return addDays(isoOf(y, 3, 22), d + e + 13);
}
const cache = new Map();
/** Επίσημες αργίες δημοσίου: { "2026-01-06": "Θεοφάνεια", … } */
export function greekHolidays(y) {
  if (cache.has(y)) return cache.get(y);
  const p = orthodoxEaster(y);
  const h = {
    [isoOf(y, 1, 1)]: "Πρωτοχρονιά", [isoOf(y, 1, 6)]: "Θεοφάνεια", [addDays(p, -48)]: "Καθαρά Δευτέρα",
    [isoOf(y, 3, 25)]: "25η Μαρτίου", [addDays(p, -2)]: "Μεγάλη Παρασκευή",
    [p]: "Πάσχα", [addDays(p, 1)]: "Δευτέρα του Πάσχα", [isoOf(y, 5, 1)]: "Πρωτομαγιά",
    [addDays(p, 50)]: "Αγίου Πνεύματος", [isoOf(y, 8, 15)]: "Δεκαπενταύγουστος", [isoOf(y, 10, 28)]: "28η Οκτωβρίου",
    [isoOf(y, 12, 25)]: "Χριστούγεννα", [isoOf(y, 12, 26)]: "Σύναξη Θεοτόκου",
  };
  cache.set(y, h);
  return h;
}
export const holidayName = (iso) => greekHolidays(parts(iso)[0])[iso] || "";

// ---------- Είδη ----------
export const kindMap = (kinds) => Object.fromEntries((kinds || []).map((k) => [k.code, k]));
export const HOLIDAY = "ΑΡΓ";

/** Η μέρα θεωρείται αργία (για τις υπερωρίες): Κυριακή ή καταχωρημένη ΑΡΓ */
export const isHolidayDay = (iso, entry) => weekday(iso) === 0 || entry?.k === HOLIDAY;

// ---------- Σύνολα μήνα / έτους (όπως το φύλλο «Σύνολα») ----------
/**
 * days: { "2026-11-25": { k: "ΑΣΘΥ", o: 3 } }
 * Μετράει όλες τις ημέρες εκτός Κυριακής (όπως WEEKDAY>1 στο Excel).
 */
export function monthStats(days, kinds, y, m) {
  const km = kindMap(kinds);
  const s = { counts: {}, otWork: 0, otHol: 0, absences: 0, holidays: 0, workdays: 0, work: 0 };
  const n = daysInMonth(y, m);
  for (let d = 1; d <= n; d++) {
    const iso = isoOf(y, m, d);
    const wd = weekday(iso);
    const e = days[iso];
    if (wd >= 1 && wd <= 5) s.workdays++;
    if (!e) continue;
    const o = Number(e.o) || 0;
    if (o) { if (isHolidayDay(iso, e)) s.otHol += o; else s.otWork += o; }
    if (wd === 0 || !e.k) continue;
    s.counts[e.k] = (s.counts[e.k] || 0) + 1;
    if (e.k === HOLIDAY) s.holidays++;
    else if (km[e.k]?.absence !== false) s.absences++;
  }
  s.work = s.workdays - s.holidays - s.absences;
  return s;
}

export function yearStats(days, kinds, y) {
  const months = [];
  const total = { counts: {}, otWork: 0, otHol: 0, absences: 0, holidays: 0, workdays: 0, work: 0 };
  for (let m = 1; m <= 12; m++) {
    const s = monthStats(days, kinds, y, m);
    months.push(s);
    for (const [k, v] of Object.entries(s.counts)) total.counts[k] = (total.counts[k] || 0) + v;
    for (const f of ["otWork", "otHol", "absences", "holidays", "workdays", "work"]) total[f] += s[f];
  }
  return { months, total };
}

/** Χρήση είδους ανά έτος (εκτός Κυριακών): { 2022: 42, … } */
export function usageByYear(days, code) {
  const u = {};
  for (const [iso, e] of Object.entries(days)) {
    if (e.k !== code || weekday(iso) === 0) continue;
    const y = parts(iso)[0];
    u[y] = (u[y] || 0) + 1;
  }
  return u;
}

// ---------- Υπόλοιπα ----------
/**
 * Υπόλοιπα για το έτος y. Για κάθε είδος με τύπο υπολοίπου:
 *   carry : μεταφορά = αρχικό + δικαίωμα × έτη − χρήση προηγούμενων ετών
 *   repo/repoP : ρεπό που δόθηκαν (έως τέλος έτους) − χρήση
 *   blood : ημέρες από αιμοδοσίες − χρήση
 *   annual: δικαίωμα έτους − χρήση έτους
 */
export function balances({ days, kinds, repo = [], blood = [], settings = {} }, y) {
  const start = Number(settings.leaveStartYear) || 2022;
  const carry0 = Number(settings.leaveCarry) || 0;
  const out = [];
  for (const k of kinds || []) {
    if (!k.balance || k.balance === "none") continue;
    const u = usageByYear(days, k.code);
    const used = u[y] || 0;
    const before = Object.entries(u).filter(([yy]) => Number(yy) < y).reduce((a, [, v]) => a + v, 0);
    const rights = Number(k.rights) || 0;
    let carry = 0, earned = 0;
    if (k.balance === "carry") {
      carry = carry0 + rights * Math.max(0, y - start) - before;
      earned = rights;
    } else if (k.balance === "repo" || k.balance === "repoP") {
      const list = repo.filter((r) => (r.kind || "ΡΕΠ") === k.code);
      const givenBefore = list.filter((r) => r.date < `${y}-01-01`).reduce((a, r) => a + (Number(r.days) || 0), 0);
      earned = list.filter((r) => r.date.startsWith(`${y}-`)).reduce((a, r) => a + (Number(r.days) || 0), 0);
      carry = givenBefore - before;
    } else if (k.balance === "blood") {
      const givenBefore = blood.filter((r) => r.date < `${y}-01-01`).reduce((a, r) => a + (Number(r.days) || 0), 0);
      earned = blood.filter((r) => r.date.startsWith(`${y}-`)).reduce((a, r) => a + (Number(r.days) || 0), 0);
      carry = givenBefore - before;
    } else if (k.balance === "annual") {
      earned = rights;
    }
    out.push({ code: k.code, name: k.name, color: k.color, type: k.balance, carry, earned, used, remaining: carry + earned - used });
  }
  return out;
}

// ---------- Υπερωρίες μήνα (για το σημείωμα) ----------
const addHours = (hm, h) => {
  const [H, M] = hm.split(":").map(Number);
  const t = H * 60 + M + Math.round(h * 60);
  return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`;
};
/**
 * Επιστρέφει { work: [...], hol: [...], totalWork, totalHol }.
 * Καθημερινή: από settings.otWorkStart (15:00). Σάββατο/Κυριακή/αργία: από settings.otHolStart (07:00).
 * Κυριακή ή ΑΡΓ → πίνακας αργίας.
 */
export function overtimeRows(days, y, m, settings = {}) {
  const ws = settings.otWorkStart || "15:00", hs = settings.otHolStart || "07:00";
  const work = [], hol = [];
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const iso = isoOf(y, m, d);
    const e = days[iso];
    const h = Number(e?.o) || 0;
    if (!h) continue;
    const holiday = isHolidayDay(iso, e);
    const start = holiday || weekday(iso) === 6 ? hs : ws;
    const row = { iso, date: dmy(iso), hours: h, time: `${start}  -  ${addHours(start, h)}` };
    (holiday ? hol : work).push(row);
  }
  return { work, hol, totalWork: work.reduce((a, r) => a + r.hours, 0), totalHol: hol.reduce((a, r) => a + r.hours, 0) };
}

// ---------- Αριθμοί ολογράφως (0–999, ουδέτερο: «ωρών») ----------
const UNITS = ["", "ένα", "δύο", "τρία", "τέσσερα", "πέντε", "έξι", "επτά", "οκτώ", "εννέα", "δέκα", "έντεκα", "δώδεκα",
  "δεκατρία", "δεκατέσσερα", "δεκαπέντε", "δεκαέξι", "δεκαεπτά", "δεκαοκτώ", "δεκαεννέα"];
const TENS = ["", "δέκα", "είκοσι", "τριάντα", "σαράντα", "πενήντα", "εξήντα", "εβδομήντα", "ογδόντα", "ενενήντα"];
const HUNDREDS = ["", "εκατό", "διακόσια", "τριακόσια", "τετρακόσια", "πεντακόσια", "εξακόσια", "επτακόσια", "οκτακόσια", "εννιακόσια"];
export function greekWords(n) {
  n = Math.round(Number(n) || 0);
  if (n === 0) return "μηδέν";
  if (n >= 1000) return String(n);
  const h = Math.floor(n / 100), r = n % 100;
  const parts = [];
  if (h) parts.push(h === 1 && r ? "εκατόν" : HUNDREDS[h]);
  if (r) parts.push(r < 20 ? UNITS[r] : [TENS[Math.floor(r / 10)], UNITS[r % 10]].filter(Boolean).join(" "));
  return parts.join(" ");
}

// ---------- OTS ----------
/** "2 Η 0 Ω" → {days:2, hours:0}, "2 Ω 0 Λ" → {days:0, hours:2} */
export function parseDuration(s) {
  const t = String(s || "");
  const d = t.match(/(\d+)\s*Η/), h = t.match(/(\d+)\s*Ω/);
  return { days: d ? Number(d[1]) : 0, hours: h ? Number(h[1]) : 0 };
}

/** Μετατρέπει γραμμές OTS σε ημέρες: { iso: [{kind, code, row}] } (μόνο Δευ–Παρ, χωρίς τις μεταφορές υπολοίπου) */
export function otsDays(ots, kinds, holidays = {}) {
  const byName = {};
  for (const k of kinds || []) for (const n of k.ots || []) byName[n.trim()] = k.code;
  const out = {};
  for (const r of ots || []) {
    if (!r.from || /μεταφορ/i.test(r.comment || "")) continue;
    if (r.approved === false) continue;
    const from = r.from.slice(0, 10), to = (r.to || r.from).slice(0, 10);
    const code = byName[(r.kind || "").trim()] || null;
    for (const iso of eachDay(from, to)) {
      const wd = weekday(iso);
      if (wd === 0 || wd === 6 || holidays[iso]) continue;
      (out[iso] ||= []).push({ kind: r.kind, code, duration: r.duration });
    }
  }
  return out;
}

/**
 * Διασταύρωση εφαρμογής ↔ OTS στο διάστημα [from, to].
 * status: ok | missingApp (υπάρχει στο OTS, όχι εδώ) | missingOts | diff | unmapped
 */
export function reconcile(days, ots, kinds, from, to) {
  const km = kindMap(kinds);
  const holidays = {};
  for (const [iso, e] of Object.entries(days)) if (e.k === HOLIDAY) holidays[iso] = true;
  const od = otsDays(ots, kinds, holidays);
  const rows = [];
  let ok = 0;
  const seen = new Set();
  for (const [iso, list] of Object.entries(od)) {
    if (iso < from || iso > to) continue;
    seen.add(iso);
    const app = days[iso]?.k || null;
    for (const o of list) {
      if (!o.code) { rows.push({ iso, status: "unmapped", ots: o.kind, app }); continue; }
      if (o.code === app) { ok++; continue; }
      rows.push({ iso, status: app ? "diff" : "missingApp", ots: o.kind, otsCode: o.code, app });
    }
  }
  const lastOts = (ots || []).reduce((a, r) => (r.from && r.from.slice(0, 10) > a ? r.from.slice(0, 10) : a), "");
  for (const [iso, e] of Object.entries(days)) {
    if (iso < from || iso > to || seen.has(iso) || !e.k || e.k === HOLIDAY) continue;
    const wd = weekday(iso);
    if (wd === 0 || wd === 6) continue;
    if (km[e.k]?.absence === false) continue; // π.χ. τηλεργασία
    rows.push({ iso, status: "missingOts", app: e.k, afterLast: iso > lastOts });
  }
  rows.sort((a, b) => a.iso.localeCompare(b.iso));
  return { ok, rows, lastOts };
}

/**
 * Συνεχόμενο διάστημα του ίδιου είδους γύρω από μια μέρα (παραλείπει Σαββατοκύριακα και αργίες).
 * Επιστρέφει { from, to, days } — days = ημέρες με αυτό το είδος.
 */
export function blockAround(days, iso, code) {
  const skip = (d) => { const wd = weekday(d); return wd === 0 || wd === 6 || days[d]?.k === HOLIDAY || !!holidayName(d); };
  const walk = (dir) => {
    let edge = iso, d = addDays(iso, dir);
    for (let guard = 0; guard < 400; guard++, d = addDays(d, dir)) {
      if (days[d]?.k === code) { edge = d; continue; }
      if (skip(d) && !days[d]?.k) continue;
      break;
    }
    return edge;
  };
  const from = walk(-1), to = walk(1);
  let n = 0;
  for (const d of eachDay(from, to)) if (days[d]?.k === code) n++;
  return { from, to, days: n };
}
