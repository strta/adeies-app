// Παραγωγή του «Υπηρεσιακού Σημειώματος» υπερωριών (.docx) από πρότυπο με {{πεδία}}.
import { overtimeRows, greekWords, MONTHS_ACC } from "./logic.js";

let jszipLoading;
export function loadScript(src, globalName) {
  if (window[globalName]) return Promise.resolve(window[globalName]);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = src; s.onload = () => res(window[globalName]); s.onerror = () => rej(new Error("Δεν φορτώθηκε το " + src));
    document.head.appendChild(s);
  });
}
const JSZip = () => (jszipLoading ||= loadScript("/vendor/jszip.min.js", "JSZip"));

const x = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RPR = '<w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:b/><w:bCs/><w:sz w:val="22"/></w:rPr>';
const cell = (text, w) => `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/><w:vAlign w:val="center"/></w:tcPr>` +
  `<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/><w:jc w:val="center"/></w:pPr>` +
  `<w:r>${RPR}<w:t xml:space="preserve">${x(text)}</w:t></w:r></w:p></w:tc>`;
const border = (v, sz) => `<w:${v} w:val="single" w:sz="${sz}" w:space="0" w:color="000000"/>`;

/** Πίνακας Word: κεφαλίδα + γραμμές (κεντραρισμένος, όπως στο Excel) */
function tableXml(head, rows) {
  const W = [1700, 2600, 900];
  const tr = (cells) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.map((c, i) => cell(c, W[i])).join("")}</w:tr>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:jc w:val="center"/><w:tblBorders>` +
    border("top", 12) + border("left", 12) + border("bottom", 12) + border("right", 12) + border("insideH", 4) + border("insideV", 4) +
    `</w:tblBorders><w:tblLayout w:type="autofit"/><w:tblLook w:val="0000"/></w:tblPr>` +
    `<w:tblGrid>${W.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>` +
    tr(head) + rows.map((r) => tr([r.date, r.time, String(r.hours)])).join("") + `</w:tbl>`;
}

async function templateBytes(template) {
  if (template?.b64) return Uint8Array.from(atob(template.b64), (c) => c.charCodeAt(0));
  const res = await fetch("/templates/ypereories.docx");
  if (!res.ok) throw new Error("Δεν βρέθηκε το πρότυπο");
  return new Uint8Array(await res.arrayBuffer());
}

// =====================================================================================
// Υπογραφή: εικόνα «πίσω από το κείμενο» στη θέση {{signature}} (μόνο όπου υπογράφει ο ίδιος)
// =====================================================================================
const SIG_REL = "rIdSignature1";
const SIG_WIDTH_CM = 4.2;
function signatureRun(sig) {
  const cx = Math.round(SIG_WIDTH_CM * 360000);
  const cy = Math.round(cx * sig.h / sig.w);
  return `<w:r><w:drawing><wp:anchor distT="0" distB="0" distL="0" distR="0" simplePos="0" relativeHeight="251659264" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">` +
    `<wp:simplePos x="0" y="0"/><wp:positionH relativeFrom="column"><wp:align>center</wp:align></wp:positionH>` +
    `<wp:positionV relativeFrom="paragraph"><wp:posOffset>${-Math.round(cy * 0.55)}</wp:posOffset></wp:positionV>` +
    `<wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:wrapNone/>` +
    `<wp:docPr id="9901" name="Υπογραφή"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr>` +
    `<a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">` +
    `<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="9901" name="signature.png"/><pic:cNvPicPr/></pic:nvPicPr>` +
    `<pic:blipFill><a:blip r:embed="${SIG_REL}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>` +
    `<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic>` +
    `</a:graphicData></a:graphic></wp:anchor></w:drawing></w:r>`;
}
/** Βάζει (ή αφαιρεί) την υπογραφή στη θέση {{signature}} */
async function applySignature(zip, doc, sig) {
  const PH = /<w:r>(?:(?!<w:r>).)*?\{\{signature\}\}.*?<\/w:r>/gs;
  if (!sig?.b64) return doc.replace(PH, "");
  zip.file("word/media/signature.png", sig.b64, { base64: true });
  let rels = await zip.file("word/_rels/document.xml.rels").async("string");
  if (!rels.includes(SIG_REL)) {
    rels = rels.replace("</Relationships>", `<Relationship Id="${SIG_REL}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/signature.png"/></Relationships>`);
    zip.file("word/_rels/document.xml.rels", rels);
  }
  let ct = await zip.file("[Content_Types].xml").async("string");
  if (!/Extension="png"/i.test(ct)) {
    ct = ct.replace("<Types ", "<Types ").replace(/(<Types[^>]*>)/, `$1<Default Extension="png" ContentType="image/png"/>`);
    zip.file("[Content_Types].xml", ct);
  }
  return doc.replace(PH, signatureRun(sig));
}

/** Φτιάχνει το .docx για τον μήνα και επιστρέφει { blob, name, rows } */
export async function buildOvertimeDoc({ days, settings, template, signature }, y, m) {
  const rows = overtimeRows(days, y, m, settings);
  const Zip = await JSZip();
  const zip = await Zip.loadAsync(await templateBytes(template));
  let doc = await zip.file("word/document.xml").async("string");
  const values = {
    curMonth: MONTHS_ACC[m - 1], curYear: String(y),
    NumHours: String(rows.totalWork), WordHours: greekWords(rows.totalWork),
    NumHoursArgia: String(rows.totalHol), WordHoursArgia: greekWords(rows.totalHol),
  };
  for (const [k, v] of Object.entries(values)) doc = doc.split(`{{${k}}}`).join(x(v));
  // Οι πίνακες αντικαθιστούν ολόκληρη την παράγραφο που έχει το {{tblHours}} / {{tblHoursArgia}}
  const tables = {
    tblHours: rows.work.length ? tableXml(["ΗΜΕΡΟΜΗΝΙΑ", "ΩΡΑΡΙΟ ΚΑΘΗΜΕΡΙΝΗΣ", "ΩΡΕΣ"], rows.work) : "",
    tblHoursArgia: rows.hol.length ? tableXml(["ΗΜΕΡΟΜΗΝΙΑ", "ΩΡΑΡΙΟ ΑΡΓΙΑΣ", "ΩΡΕΣ"], rows.hol) : "",
  };
  for (const [k, t] of Object.entries(tables)) {
    const re = new RegExp(`<w:p\\b(?:(?!<w:p\\b).)*?\\{\\{${k}\\}\\}.*?</w:p>`, "s");
    doc = doc.replace(re, t ? t + "<w:p/>" : "<w:p/>");
  }
  doc = await applySignature(zip, doc, signature);
  const left = doc.match(/\{\{\w+\}\}/g);
  if (left) console.warn("Πεδία χωρίς τιμή στο πρότυπο:", left);
  zip.file("word/document.xml", doc);
  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  return { blob, name: `Υπερωρίες ${MONTHS_ACC[m - 1]} ${y}.docx`, rows };
}

export function download(blob, name) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// =====================================================================================
// Αιτήσεις (άδεια, δίωρη, αναρρωτική) από τα πρότυπα public/templates/aitisi-*.docx
// =====================================================================================
export const FORMS = {
  adeia: { file: "aitisi-adeias.docx", title: "Αίτηση άδειας" },
  diwri: { file: "aitisi-diwris.docx", title: "Αίτηση δίωρης / μονόωρης" },
  anarrotiki: { file: "aitisi-anarrotikis.docx", title: "Αίτηση αναρρωτικής" },
};
/** Ετικέτες των κουτιών στην αίτηση άδειας (όπως στο έντυπο) */
export const ADEIA_BOXES = ["Κανονική Άδεια", "Κανονική Άδεια Κλειστού Χώρου", "Γονική", "Ρεπό Οφειλόμενο", "Αιμοδοτική Άδεια",
  "Επιστημονική", "Ειδική ΟΤΑ", "Τιμητική", "Ειδική", "Εκλογική", "Εκπαιδευτική", "Δικαστική", "Υπηρεσιακή", "Αναπλήρωσης με αποδοχές", "Άλλη"];
const KIND_FORM = {
  ΑΔΕ: ["adeia", "Κανονική Άδεια"], ΓΟΝ: ["adeia", "Γονική"], ΡΕΠ: ["adeia", "Ρεπό Οφειλόμενο"], ΡΕΠΠ: ["adeia", "Ρεπό Οφειλόμενο"],
  ΑΙΜ: ["adeia", "Αιμοδοτική Άδεια"], ΣΕΜ: ["adeia", "Εκπαιδευτική"], ΔΙΚ: ["adeia", "Δικαστική"],
  ΔΙΩ: ["diwri"], ΥΠΔΙΩ: ["diwri"], ΜΟΝ: ["diwri"], ΑΣΘ: ["anarrotiki", "doctor"], ΑΣΘΥ: ["anarrotiki", "yd"],
};
/** Ποιο έντυπο ταιριάζει σε ένα είδος (null για ΑΡΓ, τηλεργασία κ.λπ.) */
export function formFor(code) {
  if (!code || code === "ΑΡΓ" || code === "ΤΗΛ") return null;
  return KIND_FORM[code] || ["adeia", "Άλλη"];
}

/** Τσεκάρει τα κουτιά (FORMCHECKBOX) των παραγράφων που το κείμενό τους είναι μία από τις ετικέτες */
function checkBoxes(doc, labels) {
  const want = new Set(labels.map((l) => l.trim()));
  return doc.replace(/<w:p\b(?:(?!<w:p\b).)*?<\/w:p>/gs, (p) => {
    if (!p.includes("FORMCHECKBOX")) return p;
    const text = [...p.matchAll(/<w:t(?: [^>]*)?>([^<]*)<\/w:t>/g)].map((m) => m[1]).join("").replace(/\s+/g, " ").trim();
    if (!want.has(text)) return p;
    return p.replace(/(<w:checkBox>(?:(?!<\/w:checkBox>).)*?<w:default w:val=")0(")/s, "$11$2");
  });
}

/**
 * values: { today, from, to, days, date, hours, fromTime, toTime, sickText, ... }
 * opts: { check: [ετικέτες], dropParaWith: [κείμενο], signature: {b64,w,h} | null }
 */
export async function buildForm(kind, values, opts = {}) {
  const f = FORMS[kind];
  const res = await fetch("/templates/" + f.file);
  if (!res.ok) throw new Error("Δεν βρέθηκε το πρότυπο " + f.file);
  const Zip = await JSZip();
  const zip = await Zip.loadAsync(await res.arrayBuffer());
  let doc = await zip.file("word/document.xml").async("string");
  // ολόκληρες παράγραφοι που δεν χρειάζονται (π.χ. το 2ο σκέλος της αναρρωτικής)
  for (const t of opts.dropParaWith || []) {
    doc = doc.replace(new RegExp(`<w:p\\b(?:(?!<w:p\\b).)*?${t.replace(/[{}]/g, "\\$&")}.*?</w:p>`, "s"), "");
  }
  for (const [k, v] of Object.entries(values)) doc = doc.split(`{{${k}}}`).join(x(v));
  if (opts.check?.length) doc = checkBoxes(doc, opts.check);
  doc = await applySignature(zip, doc, opts.signature);
  const left = doc.match(/\{\{\w+\}\}/g);
  if (left) doc = doc.replace(/\{\{\w+\}\}/g, "……");
  zip.file("word/document.xml", doc);
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
}

/** Καθαρίζει μια φωτογραφία/σκανάρισμα υπογραφής: λευκό → διάφανο, περικοπή, πλάτος ≤ 700px */
export async function prepareSignature(file) {
  const url = URL.createObjectURL(file);
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Μη έγκυρη εικόνα")); i.src = url; });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
  for (let i = 0; i < px.length; i += 4) {
    const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    // φωτεινά → διάφανα, ομαλή μετάβαση για να μη «σπάνε» οι άκρες
    const a = lum > 235 ? 0 : lum > 180 ? Math.round((235 - lum) / 55 * 255) : 255;
    px[i + 3] = Math.min(px[i + 3], a);
    if (px[i + 3] > 40) { const p = i / 4, x = p % c.width, y = (p - x) / c.width; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 < 0) throw new Error("Δεν βρέθηκε υπογραφή στην εικόνα");
  g.putImageData(d, 0, 0);
  const pad = 6, w = x1 - x0 + 1 + 2 * pad, h = y1 - y0 + 1 + 2 * pad;
  const scale = Math.min(1, 700 / w);
  const o = document.createElement("canvas");
  o.width = Math.round(w * scale); o.height = Math.round(h * scale);
  o.getContext("2d").drawImage(c, x0 - pad, y0 - pad, w, h, 0, 0, o.width, o.height);
  URL.revokeObjectURL(url);
  const b64 = o.toDataURL("image/png").split(",")[1];
  return { b64, w: o.width, h: o.height };
}
