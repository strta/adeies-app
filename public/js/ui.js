// Μικρά βοηθητικά εμφάνισης.
export const esc = (s) => (s ?? "").toString()
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

let toastTimer;
export function toast(msg, ms = 2600) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

/**
 * Ανοίγει διάλογο με HTML περιεχόμενο. Επιστρέφει Promise με το value του κουμπιού που πατήθηκε
 * και τα δεδομένα της φόρμας: { action, data }.
 */
export function dialog(html, onMount) {
  const dlg = document.getElementById("dlg");
  const form = document.getElementById("dlgForm");
  form.innerHTML = html;
  return new Promise((resolve) => {
    let result = { action: "cancel", data: {} };
    const onSubmit = (ev) => {
      const action = ev.submitter?.value || "cancel";
      if (action !== "cancel" && action !== "delete" && !form.checkValidity()) {
        ev.preventDefault();
        form.reportValidity();
        return;
      }
      const data = Object.fromEntries(new FormData(form).entries());
      form.querySelectorAll("input[type=checkbox]").forEach((cb) => { data[cb.name] = cb.checked; });
      result = { action, data };
    };
    // Επιστρέφουμε ΜΟΝΟ αφού κλείσει τελείως ο διάλογος, ώστε να μπορεί να ανοίξει αμέσως επόμενος (π.χ. επιβεβαίωση).
    const onClose = () => {
      form.removeEventListener("submit", onSubmit);
      dlg.removeEventListener("close", onClose);
      setTimeout(() => resolve(result), 0);
    };
    form.addEventListener("submit", onSubmit);
    dlg.addEventListener("close", onClose);
    dlg.showModal();
    onMount?.(form);
  });
}

export async function confirmDlg(text, okLabel = "OK", danger = false) {
  const { action } = await dialog(`<h3>${esc(text)}</h3>
    <div class="dlg-actions"><button class="btn" value="cancel" formnovalidate>Άκυρο</button>
    <button class="btn ${danger ? "danger" : "primary"}" value="ok">${esc(okLabel)}</button></div>`);
  return action === "ok";
}
