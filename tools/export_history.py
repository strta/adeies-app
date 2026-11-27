"""Μετατρέπει το παλιό Excel (Ιστορικό αδειών/υπερωριών .xlsm) σε data/history.json
για την πρώτη εισαγωγή στην εφαρμογή (Ρυθμίσεις → Εισαγωγή ιστορικού).

Χρήση:  python tools/export_history.py "Ιστορικό.xlsm"
Χρειάζεται: pip install openpyxl
"""
import datetime as dt
import json
import os
import sys
import warnings

import openpyxl

warnings.filterwarnings("ignore")

# Τύποι υπολοίπου ανά είδος:
#   carry  : ετήσιο δικαίωμα + μεταφορά υπολοίπου (Κανονική)
#   repo   : από τον πίνακα «Ρεπό που δόθηκαν» (μη Πρόεδρος)
#   repoP  : από τον πίνακα «Ρεπό που δόθηκαν» με υπογράφοντα Πρόεδρο
#   blood  : από τις αιμοδοσίες
#   annual : ετήσιο δικαίωμα χωρίς μεταφορά
#   none   : χωρίς υπόλοιπο (μόνο καταμέτρηση)
BALANCE = {"ΑΔΕ": "carry", "ΡΕΠ": "repo", "ΡΕΠΠ": "repoP", "ΑΙΜ": "blood"}
NO_ABSENCE = {"ΤΗΛ"}  # Τηλεργασία: δεν μετράει ως απουσία
COLORS = {
    "ΑΔΕ": "#2e7d32", "ΡΕΠ": "#1565c0", "ΡΕΠΠ": "#6a1b9a", "ΑΡΓ": "#c62828", "ΑΣΘ": "#ef6c00", "ΑΣΘΥ": "#f9a825",
    "ΑΣΘΤΚΝ": "#d84315", "ΑΣCOV": "#8d6e63", "ΑΣΘΜ": "#a1887f", "ΓΟΝ": "#00838f", "ΔΙΩ": "#5c6bc0", "ΥΠΔΙΩ": "#3949ab",
    "ΜΟΝ": "#7986cb", "ΣΕΜ": "#00695c", "ΣΗΜ": "#455a64", "ΤΗΛ": "#546e7a", "ΑΙΜ": "#ad1457", "ΘΝΤ": "#424242",
    "ΔΙΚ": "#6d4c41",
}
NAMES = {"ΑΡΓ": "Αργία", "ΔΙΚ": "Δικαστική", "ΑΣCOV": "Ασθένεια Covid", "ΑΣΘΜ": "Ασθένεια μακροχρόνια", "ΑΣΘΥ": "Ασθένεια (Υπ. Δήλωση)", "ΥΠΔΙΩ": "Υπηρεσιακή δίωρη"}
EXTRA_OTS = {  # περιγραφές OTS που δεν είχαν αντιστοίχιση στο Excel
    "ΓΟΝ": ["Σχολική Άδεια 5 Ημ.", "Σχολική Άδεια 6 Ημ."],
}


def iso(v):
    if isinstance(v, dt.datetime):
        return v.date().isoformat()
    if isinstance(v, dt.date):
        return v.isoformat()
    return None


def main(path):
    wb = openpyxl.load_workbook(path, data_only=False)

    # ---- Είδη (Parameters A:G) ----
    p = wb["Parameters"]
    kinds = []
    for order, r in enumerate(p.iter_rows(min_row=2, max_row=21, max_col=7, values_only=True)):
        name, code, _, rights, ots = r[0], r[1], r[2], r[3], r[4]
        if not name:
            continue
        if not code:
            code = "ΑΣΘΜ" if "Μακ" in name else name[:4].upper()
        if code == "ΑΑ":
            continue
        rights = int(rights) if isinstance(rights, (int, float)) else 0
        bal = BALANCE.get(code, "annual" if rights else "none")
        kinds.append({
            "code": code, "name": NAMES.get(code, name.strip()), "rights": rights, "monthHours": {"ΔΙΩ": 2, "ΜΟΝ": 1}.get(code, 0), "balance": bal,
            "ots": [ots] + EXTRA_OTS.get(code, []) if ots else EXTRA_OTS.get(code, []),
            "absence": code not in NO_ABSENCE and code != "ΑΡΓ",
            "color": COLORS.get(code, "#607d8b"), "order": order,
        })

    # ---- Ρεπό που δόθηκαν (N:Q) & Αιμοδοσίες (S:T) ----
    repo, blood = [], []
    for r in p.iter_rows(min_row=2, max_row=200, min_col=14, max_col=20, values_only=True):
        signer, date, reason, days = r[0], r[1], r[2], r[3]
        if signer and isinstance(days, (int, float)):
            repo.append({
                "date": iso(date) or "2021-12-31", "signer": str(signer).strip(), "reason": (reason or "").strip(),
                "days": int(days), "kind": "ΡΕΠΠ" if str(signer).strip() == "Πρόεδρος" else "ΡΕΠ",
            })
        bdate, bdays = r[5], r[6]
        if iso(bdate) and isinstance(bdays, (int, float)):
            blood.append({"date": iso(bdate), "days": int(bdays)})

    # ---- Ιστορικό ημερών (Data): γραμμή 2 = 1/1/2022, μία γραμμή ανά ημέρα ----
    days = {}
    base = dt.date(2021, 12, 31)
    for i, row in enumerate(wb["Data"].iter_rows(min_row=2, min_col=2, max_col=3, values_only=True)):
        kind, ot = row
        d = (base + dt.timedelta(days=i + 1)).isoformat()
        e = {}
        if kind:
            e["k"] = str(kind).strip()
        if isinstance(ot, (int, float)) and ot:
            e["o"] = ot
        if e:
            days[d] = e

    # ---- OTS (ιστορικό υπηρεσίας) ----
    ots = []
    ws = wb["OTS"]
    for r in ws.iter_rows(min_row=2, max_col=19, values_only=True):
        if not r[3] or not iso(r[5]):
            continue
        ots.append({
            "kind": r[3], "comment": r[4] or "", "from": r[5].isoformat(timespec="minutes"),
            "to": r[6].isoformat(timespec="minutes") if isinstance(r[6], dt.datetime) else None,
            "duration": r[7] or "", "approved": str(r[8]) == "1", "usage": r[17] or "",
        })

    out = {
        "version": 1,
        "source": os.path.basename(path),
        "settings": {"leaveStartYear": 2022, "leaveCarry": 43, "shortLeaveLimit": 4},
        "kinds": kinds, "repo": repo, "blood": blood, "days": days, "ots": ots,
    }
    os.makedirs("data", exist_ok=True)
    with open("data/history.json", "w", encoding="utf8") as f:
        json.dump(out, f, ensure_ascii=False, indent=1)
    print(f"✓ data/history.json — {len(days)} ημέρες, {len(kinds)} είδη, {len(repo)} ρεπό, {len(blood)} αιμοδοσίες, {len(ots)} OTS")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
