# Εργαλείο ανάπτυξης: φτιάχνει τα πρότυπα public/templates/aitisi-*.docx από τα αρχικά .dotm/.doc (με {{πεδία}}).
# Χρήση: βάλε aitisi.dotm, diwri.dotm, ydil.docx στον τρέχοντα φάκελο και τρέξε python make_templates.py
import re, zipfile, sys

def load(f): 
    z=zipfile.ZipFile(f); return z, {n: z.read(n) for n in z.namelist()}

def to_docx(files):
    # αφαίρεση μακροεντολών / μετατροπή προτύπου σε απλό έγγραφο
    for n in [n for n in files if 'vbaProject' in n or 'vbaData' in n]: del files[n]
    ct=files['[Content_Types].xml'].decode()
    ct=re.sub(r'application/vnd\.ms-word\.(template|document)\.macroEnabled(Template)?\.main\+xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml',ct)
    ct=ct.replace('application/vnd.openxmlformats-officedocument.wordprocessingml.template.main+xml','application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')
    ct=re.sub(r'<Override PartName="/word/vba[^>]*/>','',ct); ct=re.sub(r'<Default Extension="bin"[^>]*/>','',ct)
    files['[Content_Types].xml']=ct.encode()
    r=files['word/_rels/document.xml.rels'].decode()
    r=re.sub(r'<Relationship [^>]*vbaProject[^>]*/>','',r)
    files['word/_rels/document.xml.rels']=r.encode()
    # attachedTemplate στο settings
    if 'word/settings.xml' in files:
        s=files['word/settings.xml'].decode(); s=re.sub(r'<w:attachedTemplate [^>]*/>','',s); files['word/settings.xml']=s.encode()
    return files

def fields_to_text(x, names_values):
    """Αντικαθιστά πεδία (DATE/PRINTDATE) με κείμενο, με τη σειρά που εμφανίζονται."""
    out=[]; i=0; vals=list(names_values)
    pat=re.compile(r'<w:r\b(?:(?!<w:r\b).)*?<w:fldChar w:fldCharType="begin"[^>]*/>.*?<w:fldChar w:fldCharType="end"[^>]*/>(?:(?!<w:r\b).)*?</w:r>', re.S)
    def rep(m):
        s=m.group(0)
        if 'FORMCHECKBOX' in s or not re.search(r'instrText[^>]*>\s*(PRINT)?DATE', s): return s
        # δεν πρέπει να περιέχει άλλο begin (εμφωλευμένο)
        if s.count('fldCharType="begin"')>1: return s
        v=vals.pop(0)
        rpr=re.search(r'<w:fldChar w:fldCharType="separate"[^>]*/>.*?(<w:rPr>.*?</w:rPr>)',s,re.S)
        rpr=rpr.group(1) if rpr else ''
        return f'<w:r>{rpr}<w:t xml:space="preserve">{v}</w:t></w:r>'
    x=pat.sub(rep,x)
    assert not vals, ('fields left', vals)
    return x

def bookmark_text(x, name, val):
    m=re.search(r'<w:bookmarkStart w:id="(\d+)" w:name="%s"/>'%name,x)
    e=x.index('<w:bookmarkEnd w:id="%s"/>'%m.group(1),m.end())
    inner=x[m.end():e]
    rpr=re.search(r'<w:rPr>.*?</w:rPr>',inner,re.S); rpr=rpr.group(0) if rpr else ''
    return x[:m.end()]+f'<w:r>{rpr}<w:t xml:space="preserve">{val}</w:t></w:r>'+x[e:]

def para_replace(x, old, new, nth=1):
    """Αντικατάσταση κειμένου που μπορεί να είναι μοιρασμένο σε πολλά runs μιας παραγράφου."""
    count=0
    def fix(pm):
        nonlocal count
        p=pm.group(0)
        ts=[(m.start(2),m.end(2),m.group(2)) for m in re.finditer(r'(<w:t(?: [^>]*)?>)([^<]*)</w:t>',p)]
        full=''.join(t for _,_,t in ts)
        start=0
        while True:
            k=full.find(old,start)
            if k<0: return p
            count+=1
            if count==nth: break
            start=k+1
        # χαρτογράφηση θέσεων
        pos=0; edits=[]; end=k+len(old); placed=False
        for a,b,t in ts:
            s0,s1=pos,pos+len(t); pos=s1
            if s1<=k or s0>=end: continue
            lo=max(k,s0)-s0; hi=min(end,s1)-s0
            nt=t[:lo]+('' if placed else new)+t[hi:]; placed=True
            edits.append((a,b,nt))
        for a,b,nt in reversed(edits): p=p[:a]+nt+p[b:]
        p=p.replace('<w:t>','<w:t xml:space="preserve">')
        return p
    y=re.sub(r'<w:p\b.*?</w:p>',fix,x,flags=re.S)
    assert count>=nth, ('not found',old)
    return y

def uncheck_all(x):
    x=re.sub(r'(<w:checkBox>.*?<w:default w:val=")1(")',r'\g<1>0\2',x,flags=re.S)
    return x.replace('<w:checked/>','')

def save(files, out, doc):
    files['word/document.xml']=doc.encode()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        for n,d in files.items(): z.writestr(n,d)

# 1) Αίτηση άδειας
_,f=load('aitisi.dotm'); f=to_docx(f); x=f['word/document.xml'].decode()
x=fields_to_text(x,['{{today}}'])
for b,v in [('Date_From','{{from}}'),('Date_Until','{{to}}'),('Days','{{days}}')]: x=bookmark_text(x,b,v)
x=uncheck_all(x); save(f,'aitisi-adeias.docx',x)

# 2) Δίωρη
_,f=load('diwri.dotm'); f=to_docx(f); x=f['word/document.xml'].decode()
x=fields_to_text(x,['{{today}}','{{date}}'])
x=para_replace(x,'2 ωρών','{{hours}} {{hoursLabel}}')
x=para_replace(x,'13:00','{{fromTime}}'); x=para_replace(x,'15:00','{{toTime}}')
x=uncheck_all(x); save(f,'aitisi-diwris.docx',x)

# 3) Υπεύθυνη δήλωση / αναρρωτική
_,f=load('ydil.docx'); x=f['word/document.xml'].decode()
x=para_replace(x,'27/11/2026','{{today}}')
x=para_replace(x,'στις 25/11/2026','{{sickText}}')
x=para_replace(x,'από ………','από {{from}}'); x=para_replace(x,'έως και …………….','έως και {{to}}'); x=para_replace(x,'διάρκειας ….','διάρκειας {{days}}')
save(f,'aitisi-anarrotikis.docx',x)

for n in ['aitisi-adeias.docx','aitisi-diwris.docx','aitisi-anarrotikis.docx']:
    t=zipfile.ZipFile(n).read('word/document.xml').decode()
    print(n, sorted(set(re.findall(r'\{\{\w+\}\}',t))), 'cb:',len(re.findall('FORMCHECKBOX',t)))
