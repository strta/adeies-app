// Οθόνες της εφαρμογής.
import {
  state, setDay, setDays, saveKinds, saveSettings, saveTemplate, saveRepo, deleteRepo, saveBlood, deleteBlood,
  importOts, importHistory, backupData, logout, DEMO,
} from "./store.js";
import {
  MONTHS, WEEKDAYS, isoOf, parts, daysInMonth, weekday, dmy, todayIso, eachDay, greekHolidays, holidayName,
  kindMap, monthStats, yearStats, balances, overtimeRows, reconcile, HOLIDAY,
} from "./logic.js";
import { buildOvertimeDoc, download, loadScript } from "./docgen.js";
import { DEFAULT_KINDS, DEFAULT_SETTINGS } from "./defaults.js";
import { esc, toast, dialog, confirmDlg } from "./ui.js";
import { OWNER_EMAIL } from "./config.js";

const settings = () => ({ ...DEFAULT_SETTINGS, ...state.settings });
const kinds = () => (state.kinds.length ? state.kinds : DEFAULT_KINDS);
const km = () => kindMap(kinds());
const kindName = (code) => km()[code]?.name || code || "";
const kindColor = (code) => km()[code]?.color || "#607d8b";
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

  el.querySelectorAll("[data-nav]").forEach((b) => b.addEventListener("click", () => { setCur(y, m + Number(b.dataset.nav)); renderMonth(el); }));
  el.querySelector("[data-today]")?.addEventListener("click", () => { setCur(now[0], now[1]); renderMonth(el); });
  el.querySelectorAll("[data-day]").forEach((c) => c.addEventListener("click", () => editDay(c.dataset.day)));
  el.querySelector("[data-doc]")?.addEventListener("click", async (ev) => {
    ev.target.disabled = true;
    try {
      const { blob, name } = await buildOvertimeDoc({ days: state.days, settings: settings(), template: state.template }, y, m);
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
  const chip = (code, name, color) => `<label class="chip" style="--c:${color}">
      <input type="radio" name="k" value="${esc(code)}" ${(e.k || "") === code ? "checked" : ""}>${esc(name)}</label>`;
  const { action, data } = await dialog(`
    <h3>${shortDate(iso)}</h3>
    ${hn ? `<div class="muted" style="color:var(--danger)">${esc(hn)}</div>` : ""}
    <label>Είδος</label>
    <div class="kind-chips">${chip("", "— Καμία", "#888")}${list.map((k) => chip(k.code, k.name, k.color)).join("")}</div>
    <label>Υπερωρία (ώρες)</label>
    <div class="kind-chips">${OT_PRESETS.map((h) => `<label class="chip" style="--c:var(--accent-bg)">
      <input type="radio" name="op" value="${h}" ${(Number(e.o) || 0) === h ? "checked" : ""}>${h || "—"}</label>`).join("")}
      <input type="number" name="o" min="0" max="24" step="0.5" value="${e.o ?? ""}" placeholder="άλλο" style="width:80px">
    </div>
    <label>Σημείωση</label>
    <input name="n" value="${esc(e.n || "")}" placeholder="π.χ. αρ. πρωτοκόλλου">
    <label>Ίδιο είδος έως και (προαιρετικά — μόνο εργάσιμες Δευ–Παρ)</label>
    <input type="date" name="to" min="${iso}">
    <div class="dlg-actions">
      ${e.k || e.o || e.n ? `<button class="btn danger" value="delete" formnovalidate>Διαγραφή</button>` : ""}
      <button class="btn" value="cancel" formnovalidate>Άκυρο</button>
      <button class="btn primary" value="save">Αποθήκευση</button>
    </div>`, (form) => {
    const o = form.querySelector("[name=o]");
    form.querySelectorAll("[name=op]").forEach((r) => r.addEventListener("change", () => { o.value = r.value === "0" ? "" : r.value; }));
    o.addEventListener("input", () => form.querySelectorAll("[name=op]").forEach((r) => { r.checked = Number(r.value) === Number(o.value || 0); }));
  });
  try {
    if (action === "delete") { await setDay(iso, null); toast("Διαγράφηκε"); return; }
    if (action !== "save") return;
    const entry = { k: data.k || "", o: Number(data.o) || 0, n: (data.n || "").trim() };
    if (data.to && data.to > iso && entry.k) {
      const changes = { [iso]: entry };
      for (const d of eachDay(iso, data.to)) {
        const wd = weekday(d);
        if (d === iso || wd === 0 || wd === 6 || holidayName(d) || state.days[d]?.k === HOLIDAY) continue;
        changes[d] = { ...(state.days[d] || {}), k: entry.k };
      }
      await setDays(changes);
      toast(`Καταχωρήθηκαν ${Object.keys(changes).length} ημέρες`);
    } else {
      await setDay(iso, entry);
    }
  } catch (err) { console.error(err); toast("Σφάλμα αποθήκευσης: " + err.message, 5000); }
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
    <div class="bal-grid">${list.map((b) => `<div class="card bal" style="border-left-color:${b.color}">
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
  el.querySelector("[data-add-repo]").addEventListener("click", () => editRepo({ date: todayIso(), days: 1, kind: "ΡΕΠ" }));
  el.querySelectorAll("[data-repo]").forEach((r) => r.addEventListener("click", () => editRepo(state.repo.find((x) => x.id === r.dataset.repo))));
  el.querySelector("[data-add-blood]").addEventListener("click", () => editBlood({ date: todayIso(), days: 2 }));
  el.querySelectorAll("[data-blood]").forEach((r) => r.addEventListener("click", () => editBlood(state.blood.find((x) => x.id === r.dataset.blood))));
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
      <input type="file" id="otsFile" accept=".xlsx,.xls,.csv">
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
      <input type="file" id="histFile" accept=".json,application/json">
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
      <div style="grid-column:1/-1;margin-top:10px"><button class="btn primary">Αποθήκευση</button></div>
    </form></div>

    <h2>Είδη αδειών</h2>
    <div class="card scroll-x"><table class="t kinds-table">
      <thead><tr><th></th><th>Κωδ.</th><th>Όνομα</th><th>Δικ./έτος</th><th>Υπόλοιπο</th><th>Απουσία</th><th>Περιγραφές OTS (μία ανά γραμμή)</th><th></th></tr></thead>
      <tbody id="kbody">${list.map((k, i) => kindRow(k, i)).join("")}</tbody>
    </table>
    <div class="row wrap" style="margin-top:10px"><button class="btn" id="kadd">+ Είδος</button><button class="btn primary" id="ksave">Αποθήκευση ειδών</button></div></div>

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
      if (!(await confirmDlg(`Εισαγωγή ${n} ημερών, ${(h.kinds || []).length} ειδών, ${(h.repo || []).length} ρεπό, ${(h.ots || []).length} εγγραφών OTS; Οι ίδιες ημέρες θα αντικατασταθούν.`, "Εισαγωγή"))) return;
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
    await saveSettings({ ...d, leaveStartYear: Number(d.leaveStartYear), leaveCarry: Number(d.leaveCarry) });
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
  el.querySelector("#tplReset")?.addEventListener("click", async () => { await saveTemplate({}); toast("Επαναφορά αρχικού προτύπου"); });
}

function kindRow(k, i) {
  return `<tr>
    <td><input type="color" name="color" value="${esc(k.color || "#607d8b")}"></td>
    <td><input name="code" value="${esc(k.code)}" style="width:80px"></td>
    <td><input name="name" value="${esc(k.name)}" style="min-width:130px"></td>
    <td><input type="number" name="rights" value="${k.rights || 0}" min="0"></td>
    <td><select name="balance">${BAL_OPTS.map(([v, l]) => `<option value="${v}" ${k.balance === v ? "selected" : ""}>${l}</option>`).join("")}</select></td>
    <td style="text-align:center"><input type="checkbox" name="absence" ${k.absence !== false ? "checked" : ""} style="width:auto"></td>
    <td><textarea name="ots" rows="${Math.max(1, (k.ots || []).length)}" style="min-width:220px">${esc((k.ots || []).join("\n"))}</textarea></td>
    <td><button type="button" class="btn small danger" data-kdel title="Αφαίρεση">✕</button></td>
  </tr>`;
}
