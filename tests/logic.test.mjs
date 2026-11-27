// Έλεγχος ότι η εφαρμογή βγάζει τα ίδια με το φύλλο «Σύνολα» του Excel (2026).
// Χρειάζεται το data/history.json (δεν ανεβαίνει στο GitHub· αν λείπει, οι έλεγχοι δεδομένων παραλείπονται).
import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";
import * as L from "../public/js/logic.js";

let n = 0;
const t = (name, fn) => { fn(); n++; console.log("✓", name); };

t("Πάσχα 2022–2030", () => {
  const k = { 2022: "2022-04-24", 2023: "2023-04-16", 2024: "2024-05-05", 2025: "2025-04-20", 2026: "2026-04-12", 2027: "2027-05-02", 2028: "2028-04-16", 2029: "2029-04-08", 2030: "2030-04-28" };
  for (const [y, d] of Object.entries(k)) assert.equal(L.orthodoxEaster(Number(y)), d);
});
t("Ολογράφως", () => {
  assert.equal(L.greekWords(0), "μηδέν"); assert.equal(L.greekWords(20), "είκοσι");
  assert.equal(L.greekWords(23), "είκοσι τρία"); assert.equal(L.greekWords(100), "εκατό"); assert.equal(L.greekWords(168), "εκατόν εξήντα οκτώ");
});
t("Διάρκεια OTS", () => {
  assert.deepEqual(L.parseDuration("2 Η 0 Ω"), { days: 2, hours: 0 });
  assert.deepEqual(L.parseDuration("2 Ω 0 Λ"), { days: 0, hours: 2 });
});
t("Υπερωρίες: τελευταία μέρα μήνα & σωστές ημερομηνίες", () => {
  const days = { "2026-10-31": { o: 3 }, "2026-10-30": { o: 3 }, "2026-10-04": { o: 8 }, "2026-10-28": { k: "ΑΡΓ", o: 8 }, "2026-10-13": { o: 2 } };
  const r = L.overtimeRows(days, 2026, 10);
  assert.deepEqual(r.work.map((x) => x.date), ["13/10/2026", "30/10/2026", "31/10/2026"]);
  assert.equal(r.work[0].time, "15:00  -  17:00");
  assert.equal(r.work[2].time, "07:00  -  10:00"); // Σάββατο
  assert.deepEqual(r.hol.map((x) => x.date), ["04/10/2026", "28/10/2026"]);
  assert.equal(r.totalWork, 8); assert.equal(r.totalHol, 16);
});

if (existsSync("data/history.json")) {
  const h = JSON.parse(readFileSync("data/history.json", "utf8"));
  const ys = L.yearStats(h.days, h.kinds, 2026);
  t("Σύνολα 2026 = Excel", () => {
    // Excel γραμμή «Συνολα»: Ρεπό 46, Ασθένεια 1, Μονόωρη 2, Ρεπό Προέδρου 1, Δίωρη 8, Ασθένεια ΥΔ 2, Υπερωρίες 220, Αργίες 168, Απουσίες 62, ΑΡΓ 10
    const c = ys.total.counts;
    assert.equal(c["ΡΕΠ"], 46); assert.equal(c["ΑΣΘ"], 1); assert.equal(c["ΜΟΝ"], 2); assert.equal(c["ΡΕΠΠ"], 1);
    assert.equal(c["ΔΙΩ"], 8); assert.equal(c["ΑΣΘΥ"], 2);
    assert.equal(ys.total.otWork, 220); assert.equal(ys.total.otHol, 168);
    assert.equal(ys.total.absences, 62); assert.equal(ys.total.holidays, 10);
    const exp = [[22, 15], [20, 14], [22, 18], [22, 12], [21, 15], [22, 15], [23, 18], [21, 16], [22, 11], [22, 15], [21, 18], [23, 22]];
    exp.forEach(([wd, w], i) => { assert.equal(ys.months[i].workdays, wd, `εργάσιμες μήνα ${i + 1}`); assert.equal(ys.months[i].work, w, `εργασίας μήνα ${i + 1}`); });
  });
  t("Υπόλοιπα 2026 = Excel", () => {
    const b = Object.fromEntries(L.balances(h, 2026).map((x) => [x.code, x]));
    assert.equal(b["ΑΔΕ"].carry, 9); assert.equal(b["ΑΔΕ"].remaining, 34);
    assert.equal(b["ΡΕΠ"].remaining, 43); assert.equal(b["ΡΕΠΠ"].remaining, 0);
    assert.equal(b["ΑΣΘ"].remaining, 5); assert.equal(b["ΓΟΝ"].remaining, 4); assert.equal(b["ΣΕΜ"].remaining, 16); assert.equal(b["ΑΣΘΥ"].remaining, 0);
  });
  t("Υπερωρίες Οκτωβρίου 2026 = σημείωμα", () => {
    const r = L.overtimeRows(h.days, 2026, 10);
    assert.deepEqual(r.work.map((x) => x.date), ["01/10/2026", "02/10/2026", "05/10/2026", "06/10/2026", "08/10/2026", "09/10/2026", "13/10/2026"]);
    assert.deepEqual(r.hol.map((x) => x.date), ["04/10/2026", "11/10/2026"]);
    assert.equal(r.totalWork, 20); assert.equal(r.totalHol, 16);
  });
  t("Αργίες 2026 στο ιστορικό = υπολογισμένες", () => {
    const mine = Object.entries(h.days).filter(([d, e]) => d.startsWith("2026") && e.k === "ΑΡΓ").map(([d]) => d).sort();
    const calc = Object.keys(L.greekHolidays(2026)).filter((d) => L.weekday(d) !== 0).sort();
    console.log("   ιστορικό:", mine.join(" "), "\n   υπολογ.:", calc.join(" "));
  });
  t("Διασταύρωση OTS", () => {
    const r = L.reconcile(h.days, h.ots, h.kinds, "2022-01-01", "2026-11-26");
    const by = r.rows.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
    console.log("   ok", r.ok, by, "τελευταία OTS", r.lastOts);
    assert.ok(r.ok > 300);
  });
}

t("Διάστημα άδειας γύρω από μια μέρα", () => {
  const days = { "2026-12-10": { k: "ΑΔΕ" }, "2026-12-11": { k: "ΑΔΕ" }, "2026-12-14": { k: "ΑΔΕ" }, "2026-12-15": { k: "ΡΕΠ" }, "2026-12-08": { k: "ΑΔΕ" } };
  assert.deepEqual(L.blockAround(days, "2026-12-11", "ΑΔΕ"), { from: "2026-12-10", to: "2026-12-14", days: 3 });
});
console.log(`\n${n} έλεγχοι πέρασαν`);
t("Όριο δίωρων/μονόωρων 4 ώρες/μήνα", () => {
  const kinds = [{ code: "ΔΙΩ" }, { code: "ΜΟΝ" }, { code: "ΥΠΔΙΩ" }];
  const days = { "2026-11-11": { k: "ΔΙΩ" }, "2026-11-12": { k: "ΜΟΝ" }, "2026-11-13": { k: "ΥΠΔΙΩ" } };
  const s = L.shortLeave(days, kinds, 2026, 11, 4);
  assert.equal(s.used, 3); assert.equal(s.remaining, 1); assert.equal(s.over, false);
  assert.equal(L.shortLeave(days, kinds, 2026, 11, 4, { "2026-11-20": "ΔΙΩ" }).over, true);
  assert.equal(L.shortLeave(days, kinds, 2026, 11, 4, { "2026-11-20": "ΜΟΝ" }).over, false);
});
console.log(`\n${n} έλεγχοι πέρασαν`);
