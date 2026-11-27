// Οθόνες της εφαρμογής.
import {
  state, setDay, setDays, saveKinds, saveSettings, saveTemplate, saveSignature, saveProfile, saveRepo, deleteRepo, saveBlood, deleteBlood,
  importOts, importHistory, backupData, logout, DEMO,
} from "./store.js";
import {
  MONTHS, WEEKDAYS, isoOf, parts, addDays, daysInMonth, weekday, dmy, todayIso, eachDay, greekHolidays, holidayName,
  kindMap, monthStats, yearStats, balances, overtimeRows, reconcile, HOLIDAY, blockAround, shortLeave, shortHoursOf,
} from "./logic.js";
import { buildOvertimeDoc, download, loadScript, buildForm, formFor, FORMS, ADEIA_BOXES, prepareSignature } from "./docgen.js";
import { DEFAULT_KINDS, DEFAULT_SETTINGS, PROFILE_FIELDS, PROFILE_DERIVED, SIGNER_DEFAULTS } from "./defaults.js";
import { esc, toast, dialog, confirmDlg } from "./ui.js";
import { OWNER_EMAIL } from "./config.js";

const settings = () => ({ ...DEFAULT_SETTINGS, ...state.settings });
const kinds = () => (state.kinds.length ? state.kinds : DEFAULT_KINDS);
const km = () => kindMap(kinds());
const kindName = (code) => km()[code]?.name || code || "";
const kindColor = (code) => km()[code]?.color || "#607d8b";
/** Η υπογραφή που μπαίνει στα έγγραφα (null αν δεν υπάρχει ή είναι απενεργοποιημένη) */
const autoSig = () => (state.signature && settings().autoSign !== false ? state.signature : null);
const shortDate = (iso) => `${WEEKDAYS[weekday(iso)]} ${dmy(iso)}`;

// Τρέχων μήνας/έτος (κρατιέται όσο είναι ανοιχτή η εφαρμογή)
const now = parts(todayIso());
const cur = JSON.parse(sessionStorage.getItem("cur") || "null") || { y: now[0], m: now[1] };
const setCur = (y, m) => {
  if (m < 1) { y--; m = 12; } if (m > 12) { y++; m = 1; }
  cur.y = y; cur.m = m; sessionStorage.setItem("cur", JSON.stringify(cur));
};
function yearsRange() {
  const ys = Object.keys(state.years).map(Number).filter(Boolean);
  const min = Math.min(...ys, now[0]), max = Math.max(now[0] + 1, ...ys.filter((y) => y <= now[0] + 1));
  const out = []; for (let y = max; y >= min; y--) out.push(y);
  return out;
}
const yearChips = (sel, attr = "data-year") => `<div class="chips">${yearsRange().map((y) =>
  `<button class="chip ${y === sel ? "on" : ""}" ${attr}="${y}">${y}</button>`).join("")}</div>`;
const noKindsNotice = () => (state.kinds.length ? "" :
  `<a class="notice" href="#/settings">Δεν έχουν εισαχθεί δεδομένα ακόμα. Πήγαινε στις <b>Ρυθμίσεις → Εισαγωγή ιστορικού</b>.</a>`);

// =====================================================================================
// Ημερολόγιο μήνα
// =====================================================================================
let slideDir = 0;
export function renderMonth(el) {
  const { y, m } = cur;
  const today = todayIso();
  const hol = greekHolidays(y);
  const first = weekday(isoOf(y, m, 1));
  const lead = (first + 6) % 7; // η εβδομάδα ξεκινά Δευτέρα
  const cells = [];
  for (let i = 0; i < lead; i++) cells.push(`<div class="day out"></div>`);
  for (let d = 1; d <= daysInMonth(y, m); d++) {
    const iso = isoOf(y, m, d);
    const e = state.days[iso] || {};
    const wd = weekday(iso);
    const cls = ["day", wd === 0 || wd === 6 ? "we" : "", hol[iso] || e.k === HOLIDAY ? "hol" : "", iso === today ? "today" : ""].join(" ");
    cells.push(`<div class="${cls}" data-day="${iso}">
      <span class="n">${d}</span>
      ${e.k ? `<span class="k" style="background:${kindColor(e.k)}" title="${esc(kindName(e.k))}">${esc(e.k)}</span>` : ""}
      ${e.o ? `<span class="o">+${e.o}ω</span>` : ""}
      ${hol[iso] && e.k !== HOLIDAY ? `<span class="hn">${esc(hol[iso])}</span>` : ""}
      ${e.n ? `<span class="note" title="${esc(e.n)}">📝</span>` : ""}
    </div>`);
  }
  const s = monthStats(state.days, kinds(), y, m);
  const ot = overtimeRows(state.days, y, m, settings());
  const used = Object.entries(s.counts).filter(([k]) => k !== HOLIDAY);
  const limit = Number(settings().shortLeaveLimit) || 0;
  const sl = shortLeave(state.days, kinds(), y, m, limit);

  el.innerHTML = `${noKindsNotice()}
    <div class="month-nav">
      <button class="btn" data-nav="-1" aria-label="Προηγούμενος">‹</button>
      <h2>${MONTHS[m - 1]} ${y}</h2>
      <button class="btn" data-nav="1" aria-label="Επόμενος">›</button>
    </div>
    <div class="cal">
      ${["Δευ", "Τρί", "Τετ", "Πέμ", "Παρ", "Σάβ", "Κυρ"].map((w, i) => `<div class="wd ${i >= 5 ? "we" : ""}">${w}</div>`).join("")}
      ${cells.join("")}
    </div>
    <div class="row between wrap" style="margin-top:8px">
      <span class="muted">Πάτα μια μέρα για καταχώρηση.</span>
      ${y !== now[0] || m !== now[1] ? `<button class="btn small" data-today>Σήμερα</button>` : ""}
    </div>

    <h2>Σύνοψη μήνα</h2>
    <div class="kpis">
      <div class="kpi"><div class="v">${ot.totalWork}</div><div class="l">Ώρες υπερωρίας (καθημερινές)</div></div>
      <div class="kpi"><div class="v">${ot.totalHol}</div><div class="l">Ώρες υπερωρίας (αργίες)</div></div>
      <div class="kpi"><div class="v">${s.absences}</div><div class="l">Απουσίες</div></div>
      <div class="kpi"><div class="v">${s.work}<span class="muted"> / ${s.workdays - s.holidays}</span></div><div class="l">Ημέρες εργασίας / εργάσιμες</div></div>
      ${limit ? `<div class="kpi"${sl.over ? ' style="outline:2px solid var(--danger)"' : ""}><div class="v ${sl.over ? "down" : ""}">${sl.used}<span class="muted"> / ${limit}</span></div>
        <div class="l">Ώρες δίωρης/μονόωρης (υπόλοιπο ${Math.max(0, sl.remaining)})</div></div>` : ""}
    </div>
    ${used.length ? `<div class="legend">${used.map(([k, v]) => `<span><i style="background:${kindColor(k)}"></i>${esc(kindName(k))}: <b>${v}</b></span>`).join("")}</div>` : ""}

    <div class="card" style="margin-top:10px">
      <div class="row between wrap">
        <div><b>Σημείωμα υπερωριών</b><div class="muted">${ot.work.length + ot.hol.length ? `${ot.work.length} καθημερινές, ${ot.hol.length} αργίες` : "Καμία υπερωρία αυτόν τον μήνα"}</div></div>
        <button class="btn primary" data-doc ${ot.work.length + ot.hol.length ? "" : "disabled"}>📄 Word</button>
      </div>
      ${ot.work.length + ot.hol.length ? `<div class="scroll-x"><table class="t" style="margin-top:8px">
        <thead><tr><th>Ημερομηνία</th><th>Ωράριο</th><th class="num">Ώρες</th></tr></thead>
        <tbody>${[...ot.work.map((r) => ({ ...r, h: false })), ...ot.hol.map((r) => ({ ...r, h: true }))].map((r) =>
          `<tr><td>${WEEKDAYS[weekday(r.iso)]} ${r.date}${r.h ? ' <span class="badge warn">αργία</span>' : ""}</td><td>${esc(r.time)}</td><td class="num">${r.hours}</td></tr>`).join("")}</tbody>
      </table></div>` : ""}
    </div>`;

  el.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => { slideDir = Number(b.dataset.nav); setCur(y, m + slideDir); renderMonth(el); }));
  // Σάρωση αριστερά/δεξιά πάνω στο ημερολόγιο → επόμενος/προηγούμενος μήνας
  const cal = el.querySelector(".cal");
  if (slideDir) { cal.classList.add(slideDir > 0 ? "in-right" : "in-left"); slideDir = 0; }
  let sx = 0, sy = 0, st = 0, swiped = false;
  cal.addEventListener("touchstart", (ev) => { const t = ev.touches[0]; sx = t.clientX; sy = t.clientY; st = Date.now(); swiped = false; }, { passive: true });
  cal.addEventListener("touchend", (ev) => {
    const t = ev.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 1.5 || Date.now() - st > 800) return;
    swiped = true;
    slideDir = dx < 0 ? 1 : -1;
    setCur(y, m + slideDir);
    renderMonth(el);
  }, { passive: true });
  cal.addEventListener("click", (ev) => { if (swiped) { ev.stopPropagation(); ev.preventDefault(); swiped = false; } }, true);
  el.querySelector("[data-today]")?.addEventListener("click", () => { setCur(now[0], now[1]); renderMonth(el); });
  el.querySelectorAll("[data-day]").forEach((c) => c.addEventListener("click", () => editDay(c.dataset.day)));
  el.querySelector("[data-doc]")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try {
      const { blob, name } = await buildOvertimeDoc({ days: state.days, settings: settings(), template: state.template, signature: autoSig(), profile: state.profile }, y, m);
      download(blob, name);
      toast("Κατέβηκε: " + name);
    } catch (e) { console.error(e); toast("Σφάλμα: " + e.message, 5000); }
    ev.target.disabled = false;
  });
}

const OT_PRESETS = [0, 1, 2, 3, 4, 5, 8];
async function editDay(iso) {
  const e = state.days[iso] || {};
  const hn = holidayName(iso);
  const list = kinds();
  const blk = e.k && e.k !== HOLIDAY ? blockAround(state.days, iso, e.k) : null;
  const chip = (code, name, color) => `<label class="chip" style="--c:${color}">
      <input type="radio" name="k" value="${esc(code)}" ${(e.k || "") === code ? "checked" : ""}>${esc(name)}</label>`;
  const { action, data } = await dialog(`
    <h3>${shortDate(iso)}</h3>
    ${hn ? `<div class="muted" style="color:var(--danger)">${esc(hn)}</div>` : ""}
    <label>Είδος</label>
    <div class="kind-chips">${chip("", "— Καμία", "#888")}${list.map((k) => chip(k.code, k.name, k.color)).join("")}</div>
    <div class="muted" id="slInfo" style="margin-top:6px"></div>
    <label>Υπερωρία (ώρες)</label>
    <div class="kind-chips">${OT_PRESETS.map((h) => `<label class="chip" style="--c:var(--accent-bg)">
      <input type="radio" name="op" value="${h}" ${(Number(e.o) || 0) === h ? "checked" : ""}>${h || "—"}</label>`).join("")}
      <input type="number" name="o" min="0" max="24" step="0.5" value="${e.o ?? ""}" placeholder="άλλο" style="width:80px">
    </div>
    <label>Σημείωση</label>
    <input name="n" value="${esc(e.n || "")}" placeholder="π.χ. αρ. πρωτοκόλλου">
    ${blk && blk.days > 1 ? `<label style="display:flex;gap:8px;align-items:center;margin-top:12px"><input type="checkbox" name="whole" style="width:auto">
      Όλο το διάστημα ${dmy(blk.from).slice(0, 5)}–${dmy(blk.to).slice(0, 5)} (${blk.days} ημέρες ${esc(e.k)})</label>` : ""}
    <label>Έως και (προαιρετικά — για καταχώρηση, αλλαγή ή διαγραφή πολλών ημερών· μόνο εργάσιμες)</label>
    <input type="date" name="to" min="${iso}">
    <div class="dlg-actions">
      ${e.k || e.o || e.n ? `<button class="btn danger" value="delete" formnovalidate>Διαγραφή</button>` : ""}
      <button class="btn" value="cancel" formnovalidate>Άκυρο</button>
      <button class="btn" value="doc" title="Αποθήκευση και αίτηση σε Word">📄 Αίτηση</button>
      <button class="btn primary" value="save">Αποθήκευση</button>
    </div>`, (form) => {
    const info = form.querySelector("#slInfo");
    const lim = Number(settings().shortLeaveLimit) || 0;
    const showSl = () => {
      const code = form.querySelector("[name=k]:checked")?.value || "";
      const h = shortHoursOf(km()[code] || { code });
      if (!lim || !h) { info.textContent = ""; return; }
      const [yy, mm] = parts(iso);
      const r = shortLeave(state.days, kinds(), yy, mm, lim, { [iso]: code });
      info.innerHTML = `${MONTHS[mm - 1]}: <b>${r.used} από ${lim}</b> ώρες δίωρης/μονόωρης` +
        (r.over ? ` — <b style="color:var(--danger)">πάνω από το όριο</b>` : ` (μένουν ${r.remaining})`);
    };
    form.querySelectorAll("[name=k]").forEach((r) => r.addEventListener("change", showSl));
    showSl();
    const o = form.querySelector("[name=o]");
    form.querySelectorAll("[name=op]").forEach((r) => r.addEventListener("change", () => { o.value = r.value === "0" ? "" : r.value; }));
    o.addEventListener("input", () => form.querySelectorAll("[name=op]").forEach((r) => { r.checked = Number(r.value) === Number(o.value || 0); }));
  });
  try {
    // Διάστημα: «όλο το διάστημα» ή «έως και»
    const range = data.whole && blk ? [blk.from, blk.to] : data.to && data.to > iso ? [iso, data.to] : null;
    const isWork = (d) => { const wd = weekday(d); return wd !== 0 && wd !== 6 && !holidayName(d) && state.days[d]?.k !== HOLIDAY; };
    /** Αφαιρεί το παλιό είδος από τις ημέρες του διαστήματος (κρατά υπερωρίες/σημειώσεις) */
    const clearRange = async (wholeEntryOn) => {
      const changes = {};
      for (const d of eachDay(range[0], range[1])) {
        const cur = state.days[d];
        if (!cur || (e.k ? cur.k !== e.k : !cur.k) || cur.k === HOLIDAY) continue;
        if (d === wholeEntryOn) { changes[d] = null; continue; }
        const { k, ...rest } = cur;
        changes[d] = Object.keys(rest).length ? rest : null;
      }
      if (wholeEntryOn) changes[wholeEntryOn] = null;
      await setDays(changes);
      return Object.keys(changes).length;
    };
    if (action === "delete") {
      if (range) {
        if (!(await confirmDlg(`Διαγραφή ${e.k ? `«${esc(kindName(e.k))}»` : "όλων των ειδών"} από ${dmy(range[0])} έως ${dmy(range[1])};`, "Διαγραφή", true))) return;
        const n = await clearRange(iso); toast(`Διαγράφηκαν ${n} ημέρες`);
      }
      else { await setDay(iso, null); toast("Διαγράφηκε"); }
      return;
    }
    if (action !== "save" && action !== "doc") return;
    const entry = { k: data.k || "", o: Number(data.o) || 0, n: (data.n || "").trim() };
    const lim = Number(settings().shortLeaveLimit) || 0;
    if (lim && entry.k && shortHoursOf(km()[entry.k] || { code: entry.k })) {
      const [yy, mm] = parts(iso);
      const r = shortLeave(state.days, kinds(), yy, mm, lim, { [iso]: entry.k });
      if (r.over && !(await confirmDlg(`Ο ${MONTHS[mm - 1]} θα έχει ${r.used} ώρες δίωρης/μονόωρης (όριο ${lim}). Αποθήκευση παρ' όλα αυτά;`, "Αποθήκευση", true))) return;
    }
    if (range && !entry.k) {
      // «Καμία» σε διάστημα = αφαίρεση του είδους από όλες τις ημέρες
      await clearRange(null);
      await setDay(iso, entry);
      toast("Αφαιρέθηκε το είδος από το διάστημα");
    } else if (range && entry.k) {
      const changes = { [iso]: entry };
      for (const d of eachDay(range[0], range[1])) {
        if (d === iso || !isWork(d)) continue;
        // στο «όλο το διάστημα» αλλάζουν μόνο οι ημέρες του ίδιου παλιού είδους
        if (data.whole && state.days[d]?.k !== e.k) continue;
        changes[d] = { ...(state.days[d] || {}), k: entry.k };
      }
      await setDays(changes);
      toast(`Καταχωρήθηκαν ${Object.keys(changes).length} ημέρες`);
    } else {
      await setDay(iso, entry);
    }
    if (action === "doc") await applicationDialog(iso, entry.k);
  } catch (err) { console.error(err); toast("Σφάλμα: " + err.message, 5000); }
}

// =====================================================================================
// Αιτήσεις σε Word (άδεια, δίωρη/μονόωρη, αναρρωτική)
// =====================================================================================
const addMin = (hm, min) => { const [h, m] = hm.split(":").map(Number); const t = h * 60 + m + min; return `${pad2(Math.floor(t / 60))}:${pad2(t % 60)}`; };
const pad2 = (n) => String(n).padStart(2, "0");
async function applicationDialog(iso, code) {
  const ff = formFor(code);
  if (!ff) { toast("Δεν υπάρχει έντυπο για αυτό το είδος. Διάλεξε πρώτα είδος άδειας."); return; }
  const [form, sub] = ff;
  const today = todayIso();
  const b = blockAround(state.days, iso, code);
  const dateRow = `<label>Ημερομηνία αίτησης</label><input type="date" name="today" value="${today}" required>` +
    (state.signature ? `<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" name="sign" style="width:auto" ${autoSig() ? "checked" : ""}> Με την υπογραφή μου</label>` : "");
  let body = "";
  if (form === "adeia") {
    body = `<label>Είδος στο έντυπο</label><select name="box">${ADEIA_BOXES.map((x) => `<option ${x === sub ? "selected" : ""}>${x}</option>`).join("")}</select>
      <div class="grid2"><div><label>Από</label><input type="date" name="from" value="${b.from}" required></div>
      <div><label>Έως και</label><input type="date" name="to" value="${b.to}" required></div></div>
      <label>Ημέρες</label><input type="number" name="days" value="${b.days}" min="1" required>${dateRow}`;
  } else if (form === "diwri") {
    const h = code === "ΜΟΝ" ? 1 : 2;
    body = `<div class="grid2"><div><label>Αίτημα</label><select name="type"><option>Άδεια Εξόδου</option><option>Βραδεία Προσέλευση</option></select></div>
      <div><label>Αιτιολογία</label><select name="reason"><option ${code === "ΥΠΔΙΩ" ? "" : "selected"}>ΓΙΑ ΙΔΙΩΤΙΚΟΥΣ ΛΟΓΟΥΣ</option><option ${code === "ΥΠΔΙΩ" ? "selected" : ""}>ΓΙΑ ΥΠΗΡΕΣΙΑ</option></select></div></div>
      <div class="grid2"><div><label>Ημερομηνία</label><input type="date" name="date" value="${iso}" required></div>
      <div><label>Ώρες</label><input type="number" name="hours" value="${h}" min="1" max="8" required></div>
      <div><label>Από</label><input type="time" name="fromTime" value="${addMin("15:00", -60 * h)}" required></div>
      <div><label>Έως και</label><input type="time" name="toTime" value="15:00" required></div></div>${dateRow}`;
  } else {
    body = `<label>Αιτούμαι με</label><select name="mode"><option value="yd" ${sub === "yd" ? "selected" : ""}>Υπεύθυνη δήλωση (ν.3528/2007 άρθ. 55 παρ. 2)</option>
        <option value="doctor" ${sub === "doctor" ? "selected" : ""}>Ιατρική γνωμάτευση</option></select>
      <div class="grid2"><div><label>Από</label><input type="date" name="from" value="${b.from}" required></div>
      <div><label>Έως και</label><input type="date" name="to" value="${b.to}" required></div></div>
      <label>Ημέρες</label><input type="number" name="days" value="${b.days}" min="1" required>${dateRow}`;
  }
  const { action, data } = await dialog(`<h3>📄 ${FORMS[form].title}</h3>${body}
    <div class="dlg-actions"><button class="btn" value="cancel" formnovalidate>Άκυρο</button><button class="btn primary" value="ok">Word</button></div>`, (f) => {
    // αλλαγή ωρών ή «έως» → υπολογισμός «από»
    const hours = f.querySelector("[name=hours]"), to = f.querySelector("[name=toTime]"), fr = f.querySelector("[name=fromTime]"), type = f.querySelector("[name=type]");
    const upd = () => { if (type.value === "Βραδεία Προσέλευση") { fr.value = "07:00"; to.value = addMin("07:00", 60 * Number(hours.value || 0)); } else fr.value = addMin(to.value, -60 * Number(hours.value || 0)); };
    hours?.addEventListener("input", upd); to?.addEventListener("change", () => { if (type.value !== "Βραδεία Προσέλευση") upd(); }); type?.addEventListener("change", upd);
  });
  if (action !== "ok") return;
  const v = { today: dmy(data.today) };
  let opts = {}, name;
  if (form === "adeia") {
    Object.assign(v, { from: dmy(data.from), to: dmy(data.to), days: data.days });
    opts = { check: [data.box] };
    name = `Αίτηση ${data.box} ${dmy(data.from).replace(/\//g, "-")}.docx`;
  } else if (form === "diwri") {
    const h = Number(data.hours);
    Object.assign(v, { date: dmy(data.date), hours: h, hoursLabel: h === 1 ? "ώρας" : "ωρών", fromTime: data.fromTime, toTime: data.toTime });
    opts = { check: [data.type, data.reason] };
    name = `Αίτηση ${h === 1 ? "μονόωρης" : "δίωρης"} ${dmy(data.date).replace(/\//g, "-")}.docx`;
  } else {
    Object.assign(v, { from: dmy(data.from), to: dmy(data.to), days: data.days,
      sickText: data.from === data.to ? `στις ${dmy(data.from)}` : `από ${dmy(data.from)} έως και ${dmy(data.to)}` });
    opts = { dropParaWith: [data.mode === "yd" ? "{{to}}" : "{{sickText}}"] };
    name = `Αίτηση αναρρωτικής ${dmy(data.from).replace(/\//g, "-")}.docx`;
  }
  opts.signature = data.sign ? state.signature : null;
  opts.profile = state.profile;
  const blob = await buildForm(form, v, opts);
  download(blob, name);
  toast("Κατέβηκε: " + name);
}

// =====================================================================================
// Υπόλοιπα + Ρεπό που δόθηκαν + Αιμοδοσίες
// =====================================================================================
let balYear = now[0];
const TYPE_LABEL = { carry: "με μεταφορά", repo: "από ρεπό που δόθηκαν", repoP: "από Πρόεδρο", blood: "από αιμοδοσίες", annual: "ετήσιο" };
export function renderBalances(el) {
  const y = balYear;
  const list = balances({ days: state.days, kinds: kinds(), repo: state.repo, blood: state.blood, settings: settings() }, y);
  el.innerHTML = `${noKindsNotice()}
    ${yearChips(y)}
    <div class="bal-grid">${list.map((b) => `<div class="card bal" data-hist="${esc(b.code)}" style="border-left-color:${b.color};cursor:pointer" title="Ιστορικό ${y}">
      <div><b>${esc(b.name)}</b> <span class="muted small">${TYPE_LABEL[b.type] || ""}</span></div>
      <div class="rem ${b.remaining < 0 ? "neg" : ""}">${b.remaining}</div>
      <div class="calc">${b.type === "annual" ? "" : `μεταφορά ${b.carry} + `}${b.type === "carry" || b.type === "annual" ? "δικαίωμα" : "νέα"} ${b.earned} − χρήση ${b.used}</div>
    </div>`).join("")}</div>

    <div class="row between month-head"><h2>Ρεπό που δόθηκαν</h2><button class="btn small" data-add-repo>+ Νέο</button></div>
    <div class="card scroll-x"><table class="t">
      <thead><tr><th>Ημερομηνία</th><th>Υπογράφων</th><th>Αιτιολογία</th><th>Είδος</th><th class="num">Ημέρες</th></tr></thead>
      <tbody>${state.repo.map((r) => `<tr data-repo="${r.id}" style="cursor:pointer"><td>${r.date ? dmy(r.date) : ""}</td><td>${esc(r.signer)}</td>
        <td>${esc(r.reason)}</td><td>${esc(r.kind)}</td><td class="num">${r.days}</td></tr>`).join("") || `<tr><td colspan="5" class="muted">—</td></tr>`}</tbody>
      <tfoot><tr><td colspan="4">Σύνολο</td><td class="num">${state.repo.reduce((a, r) => a + (Number(r.days) || 0), 0)}</td></tr></tfoot>
    </table></div>

    <div class="row between month-head"><h2>Αιμοδοσίες</h2><button class="btn small" data-add-blood>+ Νέα</button></div>
    <div class="card scroll-x"><table class="t">
      <thead><tr><th>Ημερομηνία</th><th>Σημείωση</th><th class="num">Ημέρες άδειας</th></tr></thead>
      <tbody>${state.blood.map((r) => `<tr data-blood="${r.id}" style="cursor:pointer"><td>${dmy(r.date)}</td><td>${esc(r.note || "")}</td><td class="num">${r.days}</td></tr>`).join("") || `<tr><td colspan="3" class="muted">—</td></tr>`}</tbody>
    </table></div>`;

  el.querySelectorAll("[data-year]").forEach((b) => b.addEventListener("click", () => { balYear = Number(b.dataset.year); renderBalances(el); }));
  el.querySelectorAll("[data-hist]").forEach((c) => c.addEventListener("click", () => kindHistory(c.dataset.hist, y, list.find((b) => b.code === c.dataset.hist))));
  el.querySelector("[data-add-repo]").addEventListener("click", () => editRepo({ date: todayIso(), days: 1, kind: "ΡΕΠ" }));
  el.querySelectorAll("[data-repo]").forEach((r) => r.addEventListener("click", () => editRepo(state.repo.find((x) => x.id === r.dataset.repo))));
  el.querySelector("[data-add-blood]").addEventListener("click", () => editBlood({ date: todayIso(), days: 2 }));
  el.querySelectorAll("[data-blood]").forEach((r) => r.addEventListener("click", () => editBlood(state.blood.find((x) => x.id === r.dataset.blood))));
}

/** Ιστορικό ενός είδους για ένα έτος: διαστήματα, ανά μήνα, και (για ρεπό/αιμοδοσίες) τι δόθηκε */
async function kindHistory(code, y, bal) {
  const dates = Object.keys(state.days).filter((d) => d.startsWith(`${y}-`) && state.days[d].k === code && weekday(d) !== 0).sort();
  // συνεχόμενα διαστήματα (τα Σαββατοκύριακα/αργίες ανάμεσα δεν τα «σπάνε»)
  const ranges = [];
  for (const d of dates) {
    const last = ranges[ranges.length - 1];
    if (last) {
      let gap = true;
      for (let x = addDays(last.to, 1); x < d; x = addDays(x, 1)) {
        const wd = weekday(x);
        if (!(wd === 0 || wd === 6 || state.days[x]?.k === HOLIDAY || holidayName(x))) { gap = false; break; }
      }
      if (gap) { last.to = d; last.n++; continue; }
    }
    ranges.push({ from: d, to: d, n: 1 });
  }
  const perMonth = Array(12).fill(0);
  dates.forEach((d) => perMonth[parts(d)[1] - 1]++);
  const earned = bal?.type === "repo" || bal?.type === "repoP" ? state.repo.filter((r) => (r.kind || "ΡΕΠ") === code && r.date.startsWith(`${y}-`))
    : bal?.type === "blood" ? state.blood.filter((r) => r.date.startsWith(`${y}-`)) : [];
  const notes = (d) => state.days[d]?.n ? ` <span class="muted">· ${esc(state.days[d].n)}</span>` : "";
  const { action, data } = await dialog(`
    <h3><span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${kindColor(code)}"></span> ${esc(kindName(code))} — ${y}</h3>
    ${bal ? `<div class="kpis" style="margin:8px 0">
      ${bal.type !== "annual" ? `<div class="kpi"><div class="v">${bal.carry}</div><div class="l">Μεταφορά</div></div>` : ""}
      <div class="kpi"><div class="v">${bal.earned}</div><div class="l">${bal.type === "carry" || bal.type === "annual" ? "Δικαίωμα" : "Νέα"}</div></div>
      <div class="kpi"><div class="v">${bal.used}</div><div class="l">Χρήση</div></div>
      <div class="kpi"><div class="v ${bal.remaining < 0 ? "down" : ""}">${bal.remaining}</div><div class="l">Υπόλοιπο</div></div></div>` : ""}
    <div class="legend">${perMonth.map((v, i) => v ? `<span>${MONTHS[i].slice(0, 3)}: <b>${v}</b></span>` : "").join("")}</div>
    ${ranges.length ? `<div class="scroll-y"><table class="t">
      <thead><tr><th>Από</th><th>Έως</th><th class="num">Ημ.</th></tr></thead>
      <tbody>${ranges.map((r) => `<tr><td><button type="button" class="btn small" data-go="${r.from}">${shortDate(r.from)}</button>${r.n === 1 ? notes(r.from) : ""}</td>
        <td>${r.to !== r.from ? shortDate(r.to) : ""}</td><td class="num">${r.n}</td></tr>`).join("")}</tbody>
      <tfoot><tr><td colspan="2">Σύνολο</td><td class="num">${dates.length}</td></tr></tfoot></table></div>`
      : `<p class="muted">Καμία χρήση το ${y}.</p>`}
    ${earned.length ? `<label>${bal.type === "blood" ? "Αιμοδοσίες" : "Ρεπό που δόθηκαν"} το ${y}</label>
      <table class="t"><tbody>${earned.map((r) => `<tr><td>${dmy(r.date)}</td><td>${esc(r.signer || r.note || "")}</td><td>${esc(r.reason || "")}</td><td class="num">${r.days}</td></tr>`).join("")}</tbody></table>` : ""}
    <div class="dlg-actions"><button class="btn primary" value="close">Κλείσιμο</button></div>`, (f) => {
    f.querySelectorAll("[data-go]").forEach((b) => b.addEventListener("click", () => {
      const [yy, mm] = parts(b.dataset.go); setCur(yy, mm);
      f.closest("dialog").close("close"); location.hash = "#/month";
    }));
  });
}

async function editRepo(r) {
  const repoKinds = kinds().filter((k) => k.balance === "repo" || k.balance === "repoP");
  const { action, data } = await dialog(`<h3>${r.id ? "Ρεπό" : "Νέο ρεπό"}</h3>
    <div class="grid2">
      <div><label>Ημερομηνία</label><input type="date" name="date" value="${esc(r.date)}" required></div>
      <div><label>Ημέρες</label><input type="number" name="days" value="${r.days ?? 1}" min="0" required></div>
    </div>
    <label>Υπογράφων</label><input name="signer" value="${esc(r.signer || "")}" required>
    <label>Αιτιολογία</label><input name="reason" value="${esc(r.reason || "")}" placeholder="π.χ. Εορτ">
    <label>Είδος</label><select name="kind">${repoKinds.map((k) => `<option value="${k.code}" ${k.code === r.kind ? "selected" : ""}>${esc(k.name)}</option>`).join("")}</select>
    <div class="dlg-actions">${r.id ? `<button class="btn danger" value="delete" formnovalidate>Διαγραφή</button>` : ""}
      <button class="btn" value="cancel" formnovalidate>Άκυρο</button><button class="btn primary" value="save">Αποθήκευση</button></div>`);
  if (action === "save") await saveRepo({ ...data, id: r.id });
  if (action === "delete" && await confirmDlg("Διαγραφή του ρεπό;", "Διαγραφή", true)) await deleteRepo(r.id);
}
async function editBlood(r) {
  const { action, data } = await dialog(`<h3>${r.id ? "Αιμοδοσία" : "Νέα αιμοδοσία"}</h3>
    <div class="grid2">
      <div><label>Ημερομηνία</label><input type="date" name="date" value="${esc(r.date)}" required></div>
      <div><label>Ημέρες άδειας</label><input type="number" name="days" value="${r.days ?? 2}" min="0" required></div>
    </div>
    <label>Σημείωση</label><input name="note" value="${esc(r.note || "")}">
    <div class="dlg-actions">${r.id ? `<button class="btn danger" value="delete" formnovalidate>Διαγραφή</button>` : ""}
      <button class="btn" value="cancel" formnovalidate>Άκυρο</button><button class="btn primary" value="save">Αποθήκευση</button></div>`);
  if (action === "save") await saveBlood({ ...data, id: r.id });
  if (action === "delete" && await confirmDlg("Διαγραφή της αιμοδοσίας;", "Διαγραφή", true)) await deleteBlood(r.id);
}

// =====================================================================================
// Σύνολα (όπως το φύλλο «Σύνολα»)
// =====================================================================================
let statYear = now[0];
export function renderStats(el) {
  const y = statYear;
  const ys = yearStats(state.days, kinds(), y);
  const codes = kinds().map((k) => k.code).filter((c) => c !== HOLIDAY && ys.total.counts[c]);
  const z = (v) => (v ? v : `<span class="z">0</span>`);
  const curM = y === now[0] ? now[1] : 0;
  const head = `<tr><th>Μήνας</th>${codes.map((c) => `<th title="${esc(kindName(c))}">${esc(c)}</th>`).join("")}
    <th>Υπερ.</th><th>Υπ. αργ.</th><th>Απουσ.</th><th>ΑΡΓ</th><th>Εργάσ.</th><th>Εργασίας</th></tr>`;
  const line = (label, s, cls = "") => `<tr class="${cls}"><td>${label}</td>${codes.map((c) => `<td>${z(s.counts[c])}</td>`).join("")}
    <td>${z(s.otWork)}</td><td>${z(s.otHol)}</td><td>${z(s.absences)}</td><td>${z(s.holidays)}</td><td>${s.workdays}</td><td>${s.work}</td></tr>`;

  // Ανά έτος
  const allYears = yearsRange().filter((yy) => state.years[yy]).sort();
  const perYear = allYears.map((yy) => [yy, yearStats(state.days, kinds(), yy).total]);
  const yCodes = kinds().map((k) => k.code).filter((c) => c !== HOLIDAY && perYear.some(([, t]) => t.counts[c]));

  el.innerHTML = `${noKindsNotice()}${yearChips(y)}
    <div class="card scroll-x"><table class="t stats">
      <thead>${head}</thead>
      <tbody>${ys.months.map((s, i) => line(MONTHS[i], s, i + 1 === curM ? "cur" : "")).join("")}</tbody>
      <tfoot>${line("Σύνολο", ys.total)}</tfoot>
    </table></div>
    <p class="muted">Μετρούν όλες οι ημέρες εκτός Κυριακής. «Υπ. αργ.» = υπερωρίες Κυριακής ή αργίας.</p>

    <h2>Ανά έτος</h2>
    <div class="card scroll-x"><table class="t stats">
      <thead><tr><th>Έτος</th>${yCodes.map((c) => `<th title="${esc(kindName(c))}">${esc(c)}</th>`).join("")}<th>Υπερ.</th><th>Υπ. αργ.</th><th>Απουσ.</th></tr></thead>
      <tbody>${perYear.map(([yy, t]) => `<tr class="${yy === y ? "cur" : ""}"><td>${yy}</td>${yCodes.map((c) => `<td>${z(t.counts[c])}</td>`).join("")}
        <td>${z(t.otWork)}</td><td>${z(t.otHol)}</td><td>${z(t.absences)}</td></tr>`).join("")}</tbody>
    </table></div>
    <div class="legend">${kinds().map((k) => `<span><i style="background:${k.color}"></i>${esc(k.code)} = ${esc(k.name)}</span>`).join("")}</div>`;
  el.querySelectorAll("[data-year]").forEach((b) => b.addEventListener("click", () => { statYear = Number(b.dataset.year); renderStats(el); }));
}

// =====================================================================================
// OTS: εισαγωγή αρχείου + διασταύρωση
// =====================================================================================
let otsYear = now[0];
let otsAll = false;
const ST_LABEL = { missingApp: "Λείπει εδώ", missingOts: "Λείπει στο OTS", diff: "Διαφορά", unmapped: "Χωρίς αντιστοίχιση" };

export function renderOts(el) {
  const y = otsYear;
  const from = y ? `${y}-01-01` : "2000-01-01", to = y ? `${y}-12-31` : "2100-12-31";
  const r = reconcile(state.days, state.ots, kinds(), from, to);
  const rows = r.rows.filter((x) => otsAll || !(x.status === "missingOts" && x.afterLast));
  const counts = rows.reduce((a, x) => ((a[x.status] = (a[x.status] || 0) + 1), a), {});
  const meta = state.otsMeta;
  el.innerHTML = `${noKindsNotice()}
    <div class="card">
      <b>Εισαγωγή από OTS</b>
      <div class="muted">${meta ? `Τελευταία: ${esc(meta.file || "")} · ${meta.count} εγγραφές · ${new Date(meta.importedAt).toLocaleString("el-GR")}` : "Δεν έχει γίνει εισαγωγή ακόμα."}
        ${r.lastOts ? ` · πιο πρόσφατη άδεια στο OTS: <b>${dmy(r.lastOts)}</b>` : ""}</div>
      <p class="muted">Από το OTS κάνε εξαγωγή του ιστορικού αδειών σε Excel και διάλεξέ το εδώ. Αντικαθιστά τα έτη που περιέχει.</p>
      <input type="file" id="otsFile">
    </div>

    <div class="chips"><button class="chip ${!y ? "on" : ""}" data-oy="0">Όλα</button>${yearsRange().map((yy) =>
      `<button class="chip ${yy === y ? "on" : ""}" data-oy="${yy}">${yy}</button>`).join("")}</div>
    <div class="kpis">
      <div class="kpi"><div class="v">${r.ok}</div><div class="l">Ημέρες που συμφωνούν</div></div>
      ${Object.keys(ST_LABEL).map((s) => `<div class="kpi"><div class="v">${counts[s] || 0}</div><div class="l">${ST_LABEL[s]}</div></div>`).join("")}
    </div>
    <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="otsAll" ${otsAll ? "checked" : ""} style="width:auto">
      Εμφάνιση και όσων είναι μετά την τελευταία εξαγωγή OTS</label>
    <div class="card scroll-x" style="margin-top:8px"><table class="t">
      <thead><tr><th>Ημέρα</th><th>Κατάσταση</th><th>OTS</th><th>Εδώ</th><th></th></tr></thead>
      <tbody>${rows.map((x) => `<tr>
        <td>${shortDate(x.iso)}</td><td><span class="st ${x.status}">${ST_LABEL[x.status]}</span></td>
        <td>${esc(x.ots || "")}</td><td>${x.app ? esc(kindName(x.app)) : "—"}</td>
        <td>${x.otsCode ? `<button class="btn small" data-fix="${x.iso}" data-code="${esc(x.otsCode)}" title="Γράψε το είδος του OTS">← ${esc(x.otsCode)}</button>` : ""}
          <button class="btn small" data-open="${x.iso}" title="Άνοιγμα ημέρας">✎</button></td>
      </tr>`).join("") || `<tr><td colspan="5" class="muted">Καμία διαφορά 👍</td></tr>`}</tbody>
    </table></div>
    <p class="muted">«Λείπει εδώ»: η υπηρεσία έχει άδεια που δεν έχεις καταχωρήσει. «Λείπει στο OTS»: την έχεις εδώ αλλά όχι στο OTS
      (π.χ. σεμινάρια, ή δεν έχει περαστεί ακόμα). «Χωρίς αντιστοίχιση»: το είδος του OTS δεν αντιστοιχεί σε κανένα είδος — πρόσθεσέ το στις Ρυθμίσεις.</p>`;

  el.querySelectorAll("[data-oy]").forEach((b) => b.addEventListener("click", () => { otsYear = Number(b.dataset.oy); renderOts(el); }));
  el.querySelector("#otsAll").addEventListener("change", (e) => { otsAll = e.target.checked; renderOts(el); });
  el.querySelectorAll("[data-fix]").forEach((b) => b.addEventListener("click", async () => {
    await setDay(b.dataset.fix, { ...(state.days[b.dataset.fix] || {}), k: b.dataset.code });
    toast(`${dmy(b.dataset.fix)} → ${b.dataset.code}`);
  }));
  el.querySelectorAll("[data-open]").forEach((b) => b.addEventListener("click", () => editDay(b.dataset.open)));
  el.querySelector("#otsFile").addEventListener("change", async (ev) => {
    const f = ev.target.files[0];
    if (!f) return;
    try {
      const rowsIn = await parseOtsFile(f);
      if (!rowsIn.length) throw new Error("Δεν βρέθηκαν γραμμές με «Είδος Άδειας» και «Από Ημερ.»");
      const yrs = [...new Set(rowsIn.map((r) => r.from.slice(0, 4)))].sort();
      if (!(await confirmDlg(`${rowsIn.length} εγγραφές για τα έτη ${yrs.join(", ")}. Αντικατάσταση των υπαρχόντων OTS για αυτά τα έτη;`, "Εισαγωγή"))) return;
      await importOts(rowsIn, f.name);
      toast("Έγινε εισαγωγή " + rowsIn.length + " εγγραφών");
    } catch (e) { console.error(e); toast("Σφάλμα: " + e.message, 6000); }
    ev.target.value = "";
  });
}

const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` +
  `T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
function toIso(v) {
  if (v instanceof Date && !isNaN(v)) return isoLocal(new Date(v.getTime() + 30000)); // στρογγύλευση δευτερολέπτων του Excel
  const m = String(v || "").match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}T${(m[4] || "0").padStart(2, "0")}:${m[5] || "00"}`;
  return null;
}
/** Διαβάζει την εξαγωγή του OTS (ίδιες στήλες με το φύλλο OTS του παλιού Excel) */
export async function parseOtsFile(file) {
  const XLSX = await loadScript("/vendor/xlsx.full.min.js", "XLSX");
  const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const hi = aoa.findIndex((r) => r.some((c) => String(c).trim() === "Είδος Άδειας"));
  if (hi < 0) throw new Error("Δεν βρέθηκε η στήλη «Είδος Άδειας»");
  const H = aoa[hi].map((c) => String(c).trim());
  const col = (name) => H.indexOf(name);
  const c = { kind: col("Είδος Άδειας"), comment: col("Σχόλια"), from: col("Από Ημερ."), to: col("Ως Ημερ."), dur: col("Διάρκεια"), ok: col("Εγκρίθηκε"), usage: col("Χρήση") };
  return aoa.slice(hi + 1).map((r) => ({
    kind: String(r[c.kind] || "").trim(), comment: c.comment >= 0 ? String(r[c.comment] || "") : "",
    from: toIso(r[c.from]), to: c.to >= 0 ? toIso(r[c.to]) : null, duration: c.dur >= 0 ? String(r[c.dur] || "") : "",
    approved: c.ok >= 0 ? !["0", "ΟΧΙ", "false"].includes(String(r[c.ok]).trim()) : true, usage: c.usage >= 0 ? String(r[c.usage] || "") : "",
  })).filter((r) => r.kind && r.from);
}

// =====================================================================================
// Ρυθμίσεις
// =====================================================================================
const BAL_OPTS = [["none", "Χωρίς υπόλοιπο"], ["annual", "Ετήσιο"], ["carry", "Ετήσιο + μεταφορά"], ["repo", "Ρεπό που δόθηκαν"], ["repoP", "Ρεπό Προέδρου"], ["blood", "Αιμοδοσίες"]];
export function renderSettings(el) {
  const s = settings();
  const list = kinds();
  const y = now[0];
  const missingHol = Object.keys(greekHolidays(y)).filter((d) => weekday(d) >= 1 && weekday(d) <= 5 && !state.days[d]?.k);
  el.innerHTML = `
    ${DEMO ? `<div class="notice">Δοκιμαστική λειτουργία: τα δεδομένα μένουν μόνο σε αυτόν τον browser.</div>` : ""}
    <h2>Λογαριασμός</h2>
    <div class="card row between wrap"><div>${esc(state.user?.email || OWNER_EMAIL)}</div><button class="btn small" id="logout">${DEMO ? "Μηδενισμός δοκιμής" : "Αποσύνδεση"}</button></div>

    <h2>Δεδομένα</h2>
    <div class="card">
      <label>Εισαγωγή ιστορικού (history.json από το Excel ή αντίγραφο ασφαλείας)</label>
      <input type="file" id="histFile">
      <div class="row wrap" style="margin-top:10px"><button class="btn" id="backup">⬇ Αντίγραφο ασφαλείας (JSON)</button></div>
    </div>

    <h2>Αργίες</h2>
    <div class="card row between wrap">
      <div>${missingHol.length ? `${missingHol.length} αργίες του ${y} σε καθημερινή δεν έχουν καταχωρηθεί ως ΑΡΓ:<div class="muted">${missingHol.map((d) => `${dmy(d)} ${esc(holidayName(d))}`).join(" · ")}</div>` : `Όλες οι αργίες του ${y} είναι καταχωρημένες.`}</div>
      ${missingHol.length ? `<button class="btn" id="fillHol">Καταχώρηση</button>` : ""}
    </div>

    <h2>Γενικά</h2>
    <div class="card"><form id="gen" class="grid2">
      <div><label>Έτος έναρξης κανονικής</label><input type="number" name="leaveStartYear" value="${esc(s.leaveStartYear)}"></div>
      <div><label>Υπόλοιπο κανονικής στην έναρξη</label><input type="number" name="leaveCarry" value="${esc(s.leaveCarry)}"></div>
      <div><label>Έναρξη υπερωρίας καθημερινής</label><input type="time" name="otWorkStart" value="${esc(s.otWorkStart)}"></div>
      <div><label>Έναρξη υπερωρίας Σαββάτου/αργίας</label><input type="time" name="otHolStart" value="${esc(s.otHolStart)}"></div>
      <div><label>Όριο δίωρης/μονόωρης (ώρες/μήνα, 0 = χωρίς)</label><input type="number" name="shortLeaveLimit" min="0" value="${esc(s.shortLeaveLimit)}"></div>
      <div style="grid-column:1/-1;margin-top:10px"><button class="btn primary">Αποθήκευση</button></div>
    </form></div>

    <h2>Είδη αδειών</h2>
    <div class="card scroll-x"><table class="t kinds-table">
      <thead><tr><th></th><th>Κωδ.</th><th>Όνομα</th><th>Δικ./έτος</th><th title="Ώρες που μετρούν στο μηνιαίο όριο δίωρης/μονόωρης">Ώρες ορίου</th><th>Υπόλοιπο</th><th>Απουσία</th><th>Περιγραφές OTS (μία ανά γραμμή)</th><th></th></tr></thead>
      <tbody id="kbody">${list.map((k, i) => kindRow(k, i)).join("")}</tbody>
    </table>
    <div class="row wrap" style="margin-top:10px;padding:0 14px"><button class="btn" id="kadd">+ Είδος</button><button class="btn primary" id="ksave">Αποθήκευση ειδών</button></div></div>

    <h2>Στοιχεία εγγράφων</h2>
    <div class="card">
      <p class="muted" style="margin-top:0">Μπαίνουν στις αιτήσεις και στο σημείωμα. Αποθηκεύονται μόνο στον λογαριασμό σου (όχι στα δημόσια πρότυπα).
        ${PROFILE_FIELDS.some(([k]) => !state.profile[k]) ? `<b style="color:var(--danger)">Λείπουν στοιχεία — στα έγγραφα θα βγαίνουν «……».</b>` : ""}</p>
      <form id="prof" class="grid2">${PROFILE_FIELDS.map(([k, l]) => `<div><label>${esc(l)}</label><input name="${k}" value="${esc(state.profile[k] || "")}"></div>`).join("")}
        <div style="grid-column:1/-1;margin-top:10px"><button class="btn primary">Αποθήκευση στοιχείων</button></div></form>
    </div>

    <h2>Υπογράφοντες σημειώματος υπερωριών</h2>
    <div class="card">
      <p class="muted" style="margin-top:0">Όταν αλλάζει προϊστάμενος ή διευθυντής, πάτα «+ Αλλαγή» και βάλε από πότε ισχύει.
        Κάθε σημείωμα παίρνει όσους ίσχυαν την τελευταία μέρα του μήνα του — τα παλιά βγαίνουν με τους τότε υπογράφοντες.</p>
      <div id="signers">${signerRows().map(signerRow).join("")}</div>
      <div class="row wrap" style="margin-top:10px"><button class="btn" id="sgAdd">+ Αλλαγή υπογραφόντων</button><button class="btn primary" id="sgSave">Αποθήκευση</button></div>
    </div>

    <h2>Υπογραφή</h2>
    <div class="card">
      ${state.signature ? `<div style="background:#fff;border-radius:8px;padding:8px;display:inline-block"><img src="data:image/png;base64,${state.signature.b64}" alt="Υπογραφή" style="height:70px"></div>` : `<div class="muted">Δεν έχει οριστεί υπογραφή.</div>`}
      <p class="muted">Μπαίνει μόνο εκεί που υπογράφεις εσύ («Ο Αιτών», «Υπάλληλος» στο σημείωμα υπερωριών) — ποτέ στις θέσεις των προϊσταμένων.
        Φωτογραφία ή σκανάρισμα σε λευκό χαρτί· το λευκό γίνεται διάφανο αυτόματα. Αποθηκεύεται μόνο στον λογαριασμό σου.</p>
      <div class="row wrap">
        <label class="btn" style="margin:0;color:var(--text)">⬆ ${state.signature ? "Αλλαγή" : "Ανέβασμα"}<input type="file" id="sigPut" accept="image/*" hidden></label>
        ${state.signature ? `<button class="btn danger" id="sigDel">Αφαίρεση</button>` : ""}
      </div>
      ${state.signature ? `<label style="display:flex;gap:8px;align-items:center;margin-top:10px"><input type="checkbox" id="autoSign" style="width:auto" ${s.autoSign !== false ? "checked" : ""}> Αυτόματα σε όλα τα έγγραφα</label>` : ""}
    </div>

    <h2>Πρότυπο σημειώματος υπερωριών</h2>
    <div class="card">
      <div>${state.template?.name ? `Δικό σου πρότυπο: <b>${esc(state.template.name)}</b>` : "Χρησιμοποιείται το αρχικό πρότυπο."}</div>
      <p class="muted">Για αλλαγές (π.χ. υπογράφοντες): κατέβασε το πρότυπο, άλλαξέ το στο Word κρατώντας τα πεδία
        {{curMonth}} {{curYear}} {{WordHours}} {{NumHours}} {{WordHoursArgia}} {{NumHoursArgia}} {{tblHours}} {{tblHoursArgia}}, και ανέβασέ το.</p>
      <div class="row wrap"><button class="btn" id="tplGet">⬇ Πρότυπο</button>
        <label class="btn" style="margin:0;color:var(--text)">⬆ Ανέβασμα<input type="file" id="tplPut" accept=".docx" hidden></label>
        ${state.template?.name ? `<button class="btn danger" id="tplReset">Επαναφορά αρχικού</button>` : ""}</div>
    </div>`;

  el.querySelector("#logout").addEventListener("click", async () => { if (await confirmDlg(DEMO ? "Διαγραφή όλων των δοκιμαστικών δεδομένων;" : "Αποσύνδεση;", "OK", DEMO)) logout(); });
  el.querySelector("#histFile").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const h = JSON.parse(await f.text());
      const n = Object.keys(h.days || {}).length;
      const msg = n || h.kinds?.length ? `Εισαγωγή ${n} ημερών, ${(h.kinds || []).length} ειδών, ${(h.repo || []).length} ρεπό, ${(h.ots || []).length} εγγραφών OTS${h.profile ? ", προσωπικών στοιχείων" : ""}; Οι ίδιες ημέρες θα αντικατασταθούν.`
        : h.profile ? "Εισαγωγή προσωπικών στοιχείων για τα έγγραφα;" : "Το αρχείο δεν έχει δεδομένα.";
      if (!(await confirmDlg(msg, "Εισαγωγή"))) return;
      toast("Εισαγωγή…", 10000);
      await importHistory(h);
      toast("Ολοκληρώθηκε η εισαγωγή");
    } catch (e) { console.error(e); toast("Σφάλμα: " + e.message, 6000); }
    ev.target.value = "";
  });
  el.querySelector("#backup").addEventListener("click", () => {
    download(new Blob([JSON.stringify(backupData(), null, 1)], { type: "application/json" }), `adeies-backup-${todayIso()}.json`);
  });
  el.querySelector("#fillHol")?.addEventListener("click", async () => {
    await setDays(Object.fromEntries(missingHol.map((d) => [d, { ...(state.days[d] || {}), k: HOLIDAY }])));
    toast("Καταχωρήθηκαν οι αργίες");
  });
  el.querySelector("#gen").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(ev.target).entries());
    await saveSettings({ ...d, leaveStartYear: Number(d.leaveStartYear), leaveCarry: Number(d.leaveCarry), shortLeaveLimit: Number(d.shortLeaveLimit) || 0 });
    toast("Αποθηκεύτηκε");
  });
  const kbody = el.querySelector("#kbody");
  el.querySelector("#kadd").addEventListener("click", () => {
    kbody.insertAdjacentHTML("beforeend", kindRow({ code: "", name: "", rights: 0, balance: "none", absence: true, color: "#607d8b", ots: [] }, kbody.children.length));
  });
  kbody.addEventListener("click", (e) => { if (e.target.matches("[data-kdel]")) e.target.closest("tr").remove(); });
  el.querySelector("#ksave").addEventListener("click", async () => {
    const out = [...kbody.querySelectorAll("tr")].map((tr, i) => {
      const v = (n) => tr.querySelector(`[name=${n}]`);
      return {
        code: v("code").value.trim().toUpperCase(), name: v("name").value.trim(), rights: Number(v("rights").value) || 0,
        monthHours: Number(v("monthHours").value) || 0,
        balance: v("balance").value, absence: v("absence").checked, color: v("color").value,
        ots: v("ots").value.split("\n").map((s) => s.trim()).filter(Boolean), order: i,
      };
    }).filter((k) => k.code && k.name);
    const dup = out.map((k) => k.code).find((c, i, a) => a.indexOf(c) !== i);
    if (dup) return toast("Διπλός κωδικός: " + dup, 4000);
    await saveKinds(out);
    toast("Αποθηκεύτηκαν τα είδη");
  });
  el.querySelector("#tplGet").addEventListener("click", async () => {
    const blob = state.template?.b64 ? new Blob([Uint8Array.from(atob(state.template.b64), (c) => c.charCodeAt(0))]) : await (await fetch("/templates/ypereories.docx")).blob();
    download(blob, state.template?.name || "Πρότυπο υπερωριών.docx");
  });
  el.querySelector("#tplPut").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      if (f.size > 700000) throw new Error("Το αρχείο είναι πολύ μεγάλο (μέγιστο 700 KB)");
      const buf = new Uint8Array(await f.arrayBuffer());
      const JSZip = await loadScript("/vendor/jszip.min.js", "JSZip");
      const xml = await (await JSZip.loadAsync(buf)).file("word/document.xml").async("string");
      if (!xml.includes("{{tblHours}}")) throw new Error("Το πρότυπο δεν έχει το πεδίο {{tblHours}} (ίσως το Word το «έσπασε» — γράψ' το ξανά μονοκόμματο)");
      let bin = ""; buf.forEach((b) => { bin += String.fromCharCode(b); });
      await saveTemplate({ name: f.name, b64: btoa(bin), updatedAt: new Date().toISOString() });
      toast("Αποθηκεύτηκε το πρότυπο");
    } catch (e) { toast("Σφάλμα: " + e.message, 6000); }
    ev.target.value = "";
  });
  el.querySelector("#prof").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const d = Object.fromEntries([...new FormData(ev.target).entries()].map(([k, v]) => [k, String(v).trim()]));
    const merged = { ...state.profile, ...d };
    PROFILE_DERIVED.forEach((k) => delete merged[k]);
    await saveProfile(merged);
    toast("Αποθηκεύτηκαν τα στοιχεία");
  });
  const sgBox = el.querySelector("#signers");
  el.querySelector("#sgAdd").addEventListener("click", () => {
    const rows = readSigners(sgBox);
    const last = rows.sort((a, b) => (a.from || "").localeCompare(b.from || "")).pop() || { ...SIGNER_DEFAULTS };
    sgBox.insertAdjacentHTML("beforeend", signerRow({ ...last, from: todayIso() }));
    sgBox.lastElementChild.scrollIntoView({ block: "center" });
  });
  sgBox.addEventListener("click", (e) => { if (e.target.matches("[data-sgdel]")) e.target.closest(".sg").remove(); });
  el.querySelector("#sgSave").addEventListener("click", async () => {
    const signers = readSigners(sgBox).sort((a, b) => (a.from || "").localeCompare(b.from || ""));
    const { signer1, signer2, ...rest } = state.profile;
    await saveProfile({ ...rest, signers });
    toast("Αποθηκεύτηκαν οι υπογράφοντες");
  });
  el.querySelector("#sigPut").addEventListener("change", async (ev) => {
    const f = ev.target.files[0]; if (!f) return;
    try {
      const sig = await prepareSignature(f);
      await saveSignature({ ...sig, updatedAt: new Date().toISOString() });
      toast("Αποθηκεύτηκε η υπογραφή");
    } catch (e) { toast("Σφάλμα: " + e.message, 6000); }
    ev.target.value = "";
  });
  el.querySelector("#sigDel")?.addEventListener("click", async () => {
    if (await confirmDlg("Αφαίρεση της υπογραφής;", "Αφαίρεση", true)) { await saveSignature({}); toast("Αφαιρέθηκε"); }
  });
  el.querySelector("#autoSign")?.addEventListener("change", (e) => saveSettings({ autoSign: e.target.checked }));
  el.querySelector("#tplReset")?.addEventListener("click", async () => { await saveTemplate({}); toast("Επαναφορά αρχικού προτύπου"); });
}

const SG_FIELDS = [["title1", "Τμήμα — τίτλος"], ["name1", "Τμήμα — ονοματεπώνυμο"], ["title2", "Διεύθυνση — τίτλος (γρ. 1)"],
  ["title2b", "Διεύθυνση — τίτλος (γρ. 2)"], ["name2", "Διεύθυνση — ονοματεπώνυμο"]];
function signerRows() {
  const p = state.profile || {};
  if (p.signers?.length) return p.signers;
  if (p.signer1 || p.signer2) return [{ from: "", ...SIGNER_DEFAULTS, name1: p.signer1 || "", name2: p.signer2 || "" }];
  return [{ from: "", ...SIGNER_DEFAULTS, name1: "", name2: "" }];
}
function signerRow(sg) {
  return `<div class="sg card" style="box-shadow:none;border:1px solid var(--line);margin:8px 0">
    <div class="row between"><div style="flex:1"><label style="margin-top:0">Ισχύει από (κενό = από πάντα)</label><input type="date" name="from" value="${esc(sg.from || "")}"></div>
      <button type="button" class="btn small danger" data-sgdel title="Αφαίρεση" style="margin-left:8px">✕</button></div>
    <div>${SG_FIELDS.map(([k, l]) => `<div><label>${l}</label><input name="${k}" value="${esc(sg[k] ?? SIGNER_DEFAULTS[k] ?? "")}"></div>`).join("")}</div>
  </div>`;
}
function readSigners(box) {
  return [...box.querySelectorAll(".sg")].map((c) => Object.fromEntries(["from", ...SG_FIELDS.map(([k]) => k)]
    .map((k) => [k, c.querySelector(`[name=${k}]`).value.trim()]))).filter((x) => x.name1 || x.name2);
}

function kindRow(k, i) {
  return `<tr>
    <td><input type="color" name="color" value="${esc(k.color || "#607d8b")}"></td>
    <td><input name="code" value="${esc(k.code)}" style="width:80px"></td>
    <td><input name="name" value="${esc(k.name)}" style="min-width:130px"></td>
    <td><input type="number" name="rights" value="${k.rights || 0}" min="0"></td>
    <td><input type="number" name="monthHours" value="${shortHoursOf(k)}" min="0"></td>
    <td><select name="balance">${BAL_OPTS.map(([v, l]) => `<option value="${v}" ${k.balance === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
    <td style="text-align:center"><input type="checkbox" name="absence" ${k.absence !== false ? "checked" : ""} style="width:auto"></td>
    <td><textarea name="ots" rows="${Math.max(1, (k.ots || []).length)}" style="min-width:220px">${esc((k.ots || []).join("\n"))}</textarea></td>
    <td><button type="button" class="btn small danger" data-kdel title="Αφαίρεση">✕</button></td>
  </tr>`;
}
