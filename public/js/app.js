import { state, subscribe, onAuth, login, DEMO } from "./store.js";
import { renderMonth, renderBalances, renderStats, renderOts, renderSettings } from "./views.js";
import { toast } from "./ui.js";
import { OWNER_EMAIL } from "./config.js";

const ROUTES = {
  month: ["Ημερολόγιο", renderMonth],
  balances: ["Υπόλοιπα", renderBalances],
  stats: ["Σύνολα", renderStats],
  ots: ["Διασταύρωση OTS", renderOts],
  settings: ["Ρυθμίσεις", renderSettings],
};

const $ = (id) => document.getElementById(id);
const current = () => (location.hash.replace(/^#\//, "") || "month").split("?")[0];

function render() {
  if (!state.user) return;
  const name = ROUTES[current()] ? current() : "month";
  const [title, fn] = ROUTES[name];
  $("title").textContent = title + (DEMO ? " · δοκιμή" : "");
  document.querySelectorAll(".tabs a").forEach((a) => a.classList.toggle("active", a.dataset.tab === name));
  const ae = document.activeElement;
  if (ae && $("view").contains(ae) && ae.matches("input:not([type=file]):not([type=checkbox]), textarea, select")) {
    ae.addEventListener("blur", () => setTimeout(render, 0), { once: true });
    return;
  }
  if ($("dlg").open) return;
  if (!state.ready) { $("view").innerHTML = `<div class="empty">Φόρτωση…</div>`; return; }
  const scroll = window.scrollY;
  fn($("view"));
  window.scrollTo(0, scroll);
}

window.addEventListener("hashchange", () => {
  const ae = document.activeElement;
  if (ae && $("view").contains(ae)) ae.blur();
  window.scrollTo(0, 0);
  render();
});
subscribe(render);
$("dlg").addEventListener("close", () => setTimeout(render, 0));
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") render(); });

onAuth((user) => {
  const ok = state.user;
  $("login").hidden = !!ok;
  $("app").hidden = !ok;
  if (user && !ok) $("loginMsg").textContent = `Ο λογαριασμός ${user.email} δεν έχει πρόσβαση. Χρησιμοποίησε το ${OWNER_EMAIL}.`;
  if (ok) render();
}).catch((e) => { console.error(e); $("login").hidden = false; $("loginMsg").textContent = "Σφάλμα φόρτωσης: " + e.message; });

$("btnLogin").addEventListener("click", async () => {
  try { await login(); } catch (e) { console.error(e); $("loginMsg").textContent = "Σφάλμα σύνδεσης: " + e.message; }
});

if ("serviceWorker" in navigator && !DEMO) navigator.serviceWorker.register("/sw.js").catch((e) => console.warn("SW", e));
window.addEventListener("online", () => toast("Ξανά online"));
window.addEventListener("offline", () => toast("Εκτός σύνδεσης — οι αλλαγές θα σταλούν όταν επανέλθει"));
