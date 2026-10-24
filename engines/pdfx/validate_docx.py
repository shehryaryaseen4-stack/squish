"""Checks that a .docx file is a valid Word document before anyone gets to download it.

    pdf2docx-python engines/pdfx/validate_docx.py <file.docx>   -> prints "ok" or the problems, exit 0 / 1

Word refuses files that LibreOffice happily opens, so this checks what Word checks:
  - a readable ZIP with [Content_Types].xml, _rels/.rels and the main document part
  - every part has a content type, and every relationship target exists
  - every XML part is well-formed and has no characters XML does not allow
  - every r:id / r:embed / r:link points at a relationship of that part
  - drawing ids (wp:docPr) are unique, list numbers (numId) are defined, embedded fonts have a
    proper key and an obfuscated-font part
  - the document, headers, footers, numbering, styles, settings and font table match the
    WordprocessingML schema (ECMA-376 transitional, in xsd/, plus Word 2010 shapes), after
    markup compatibility is applied the way Word applies it (mc:AlternateContent -> the choice
    Word understands; ignorable w14/w15/... markup dropped)
"""
import os
import posixpath
import re
import sys
import zipfile

from lxml import etree

HERE = os.path.dirname(os.path.abspath(__file__))
NS = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
    'wp': 'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'ct': 'http://schemas.openxmlformats.org/package/2006/content-types',
    'pr': 'http://schemas.openxmlformats.org/package/2006/relationships',
}
DOC_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
OFFICE_DOC = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument'
# namespaces a Word 2010+ reader understands (others in mc:Ignorable are dropped)
UNDERSTOOD = {
    'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
    'http://schemas.openxmlformats.org/drawingml/2006/main',
    'http://schemas.openxmlformats.org/drawingml/2006/picture',
    'http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing',
    'http://schemas.openxmlformats.org/officeDocument/2006/math',
    'http://schemas.microsoft.com/office/word/2010/wordprocessingShape',
}
BAD_CHARS = re.compile('[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]')
_schema = None


def schema():
    global _schema
    if _schema is None:
        _schema = etree.XMLSchema(etree.parse(os.path.join(HERE, 'xsd', 'all.xsd')))
    return _schema


def apply_mce(root):
    """Markup compatibility as Word applies it: keep the mc:Choice it understands (else the
    fallback), and drop attributes/elements of namespaces listed as ignorable."""
    ignorable = set()
    for el in root.iter():
        val = el.get(f'{{{NS["mc"]}}}Ignorable')
        if val:
            for prefix in val.split():
                uri = el.nsmap.get(prefix)
                if uri and uri not in UNDERSTOOD:
                    ignorable.add(uri)
    for ac in list(root.iter(f'{{{NS["mc"]}}}AlternateContent')):
        chosen = None
        for ch in ac:
            if ch.tag == f'{{{NS["mc"]}}}Choice':
                req = ch.get('Requires', '').split()
                if all(ch.nsmap.get(p) in UNDERSTOOD for p in req):
                    chosen = ch
                    break
            elif ch.tag == f'{{{NS["mc"]}}}Fallback':
                chosen = chosen or ch
        parent = ac.getparent()
        idx = parent.index(ac)
        parent.remove(ac)
        if chosen is not None:
            for i, child in enumerate(list(chosen)):
                parent.insert(idx + i, child)
    for el in list(root.iter()):
        if not isinstance(el.tag, str):
            continue
        if etree.QName(el).namespace in ignorable:
            el.getparent().remove(el)
            continue
        for a in list(el.attrib):
            ns = etree.QName(a).namespace
            if ns in ignorable or ns == NS['mc']:
                del el.attrib[a]
    return root


def validate(path):
    problems = []
    if not os.path.exists(path) or os.path.getsize(path) == 0:
        return ['the file is missing or empty']
    try:
        z = zipfile.ZipFile(path)
        bad = z.testzip()
        if bad:
            return [f'damaged ZIP entry: {bad}']
    except zipfile.BadZipFile:
        return ['not a ZIP archive (a .docx must be one)']
    names = set(z.namelist())
    for need in ('[Content_Types].xml', '_rels/.rels'):
        if need not in names:
            problems.append(f'missing {need}')
    if problems:
        return problems

    def xml(name):
        data = z.read(name)
        try:
            text = data.decode('utf-8')
        except UnicodeDecodeError:
            problems.append(f'{name}: not UTF-8')
            return None
        if BAD_CHARS.search(text):
            problems.append(f'{name}: contains characters XML does not allow')
        try:
            return etree.fromstring(data)
        except etree.XMLSyntaxError as e:
            problems.append(f'{name}: not well-formed XML ({e})')
            return None

    ct = xml('[Content_Types].xml')
    defaults = {d.get('Extension').lower(): d.get('ContentType') for d in ct.findall('ct:Default', NS)} if ct is not None else {}
    overrides = {o.get('PartName'): o.get('ContentType') for o in ct.findall('ct:Override', NS)} if ct is not None else {}
    content_type = lambda n: overrides.get('/' + n) or defaults.get(n.rsplit('.', 1)[-1].lower())
    for n in names:
        if n.endswith('/') or n == '[Content_Types].xml':
            continue
        if not content_type(n):
            problems.append(f'{n}: no content type')

    rels_of = {}
    for n in sorted(names):
        if not n.endswith('.rels'):
            continue
        root = xml(n)
        if root is None:
            continue
        base = posixpath.dirname(posixpath.dirname(n))
        source = posixpath.join(base, posixpath.basename(n)[:-5]) if n != '_rels/.rels' else ''
        ids = {}
        for rel in root.findall('pr:Relationship', NS):
            rid, target, mode = rel.get('Id'), rel.get('Target'), rel.get('TargetMode')
            if rid in ids:
                problems.append(f'{n}: relationship id {rid} used twice')
            ids[rid] = rel
            if mode != 'External':
                full = posixpath.normpath(target.lstrip('/') if target.startswith('/') else posixpath.join(base, target))
                if full not in names:
                    problems.append(f'{n}: {rid} points at missing part {full}')
        rels_of[source] = ids
    main = [r.get('Target').lstrip('/') for r in rels_of.get('', {}).values() if r.get('Type') == OFFICE_DOC]
    if not main or main[0] not in names:
        return problems + ['no main document part']
    doc = main[0]
    if content_type(doc) != DOC_TYPE:
        problems.append(f'{doc}: wrong content type {content_type(doc)}')

    docpr_ids = set()
    num_ids = set()
    numbering = None
    for n in sorted(names):
        if not n.endswith('.xml') or n.startswith('[') or n.endswith('.rels'):
            continue
        root = xml(n)
        if root is None:
            continue
        rels = rels_of.get(n, {})
        for el in root.iter():
            if not isinstance(el.tag, str):
                continue
            for a, v in el.attrib.items():
                if etree.QName(a).namespace == NS['r'] and etree.QName(a).localname in ('id', 'embed', 'link', 'pict') and v not in rels:
                    problems.append(f'{n}: {etree.QName(el).localname} refers to {v}, which is not a relationship of this part')
        for d in root.iter(f'{{{NS["wp"]}}}docPr'):
            i = d.get('id')
            if i in docpr_ids:
                problems.append(f'{n}: drawing id {i} used twice')
            docpr_ids.add(i)
        for np_ in root.iter(f'{{{NS["w"]}}}numId'):
            num_ids.add(np_.get(f'{{{NS["w"]}}}val'))
        if root.tag == f'{{{NS["w"]}}}numbering':
            numbering = root
        if root.tag == f'{{{NS["w"]}}}fonts':
            for emb in root.iter():
                if isinstance(emb.tag, str) and etree.QName(emb).localname.startswith('embed'):
                    key = emb.get(f'{{{NS["w"]}}}fontKey', '')
                    if not re.fullmatch(r'\{[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}\}', key):
                        problems.append(f'{n}: embedded font with a bad key {key!r}')
                    rel = rels.get(emb.get(f'{{{NS["r"]}}}id'))
                    if rel is not None:
                        part = posixpath.normpath(posixpath.join(posixpath.dirname(n), rel.get('Target')))
                        if content_type(part) != 'application/vnd.openxmlformats-officedocument.obfuscatedFont':
                            problems.append(f'{part}: an embedded font must be an obfuscated font part')
        if root.tag in {f'{{{NS["w"]}}}{t}' for t in ('document', 'hdr', 'ftr', 'numbering', 'styles', 'settings', 'fonts')}:
            check = apply_mce(etree.fromstring(etree.tostring(root)))
            if not schema().validate(check):
                for err in list(schema().error_log)[:8]:
                    problems.append(f'{n} line {err.line}: {err.message}')
    defined = set()
    if numbering is not None:
        defined = {nm.get(f'{{{NS["w"]}}}numId') for nm in numbering.findall('w:num', NS)}
    for i in num_ids - defined - {'0'}:
        problems.append(f'list number {i} is used but not defined in numbering.xml')
    return problems


if __name__ == '__main__':
    found = validate(sys.argv[1])
    print('ok' if not found else '\n'.join(found))
    sys.exit(1 if found else 0)
