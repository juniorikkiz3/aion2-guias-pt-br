"""Validate built pages against the captured source before publishing."""
from pathlib import Path
from collections import Counter
from urllib.parse import urljoin,urlparse,unquote
import json,re
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent.parent
OUT=ROOT/'dist';SNAP=ROOT/'source-snapshot'
missing=set();broken=[]
pages=list(OUT.glob('en/**/index.html'))+list(OUT.glob('pt-BR/**/index.html'))
assert pages,'Build the site first'
for page in pages:
    raw=page.read_text(encoding='utf8');soup=BeautifulSoup(raw,'html.parser')
    for script in soup.find_all('script',type='application/json'):json.loads(script.string)
    assert not soup.html.get('data-api'),page
    assert not soup.select('.report-open,.feedback,.fc,.sec-vote,.ck,.ck-open,[data-pt-api]'),page
    assert 'googletagmanager' not in raw and 'ZXQ' not in raw,page
    for el in soup.find_all(True):
        for attr in ['src','href','data-index']:
            value=el.get(attr)
            if not value or value.startswith(('https:','http:','data:','mailto:','tel:')):continue
            parsed=urlparse(urljoin('https://local/'+page.relative_to(OUT).as_posix(),value))
            target=OUT/unquote(parsed.path.lstrip('/'))
            if parsed.path.endswith('/'):target=target/'index.html'
            if not target.exists():broken.append([page.relative_to(OUT).as_posix(),attr,value])
    for asset in re.findall(r'assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|svg|ico|woff2)',raw.replace('\\/','/')):
        if not (OUT/asset).exists():missing.add(asset)
for css in (OUT/'assets/css').glob('*.css'):
    for value in re.findall(r'url\([\'"]?([^\)\'\"]+)',css.read_text(encoding='utf8')):
        if value.startswith(('data:','https:')):continue
        target=(css.parent/value.split('?')[0]).resolve()
        if not target.exists():missing.add(str(target))
assert not missing and not broken,json.dumps({'missing':sorted(missing),'broken':broken})

for sourcefile in (SNAP/'en').rglob('index.html'):
    rel=sourcefile.relative_to(SNAP/'en')
    source=BeautifulSoup(sourcefile.read_text(encoding='utf8'),'html.parser')
    for lang in ['en','pt-BR']:
        target=BeautifulSoup((OUT/lang/rel).read_text(encoding='utf8'),'html.parser')
        for selector,attrs in [('[data-sk-card]',['data-sk-card']),('.mode-switch button',['data-set-mode','disabled']),('[data-dvb-total]',['min','max','value']),('[data-dvb-range]',['min','max','value']),('.wk-item',['data-id','data-max','data-scope','data-il','data-inactive','data-period']),('[data-until]',['data-until'])]:
            a=[[el.get(key) for key in attrs] for el in source.select(selector)]
            b=[[el.get(key) for key in attrs] for el in target.select(selector)]
            assert a==b,(lang,str(rel),selector)
        a=source.find('script',id='sk-data');b=target.find('script',id='sk-data')
        if a:assert json.loads(a.string)==json.loads(b.string),(lang,str(rel),'skill data')
        a=source.find('script',id='tracker-config');b=target.find('script',id='tracker-config')
        if a:
            a=json.loads(a.string);b=json.loads(b.string)
            for key in ['energy','reset','unlocks','cls_slugs','guides']:assert a.get(key)==b.get(key),(lang,str(rel),key)
        a=source.find('script',id='timers-cfg');b=target.find('script',id='timers-cfg')
        if a:
            a=json.loads(a.string);b=json.loads(b.string)
            assert a['schedules']==b['schedules'],(lang,str(rel),'timer schedules')
            assert [[r[0],*r[2:]] for r in a['regions']]==[[r[0],*r[2:]] for r in b['regions']],(lang,str(rel),'region ids and time zones')
        for selector,attrs in [('[data-sk]',['data-sk']),('.dvb-panel',['data-tab-panel','data-dvb-nobudget']),('.dvb-n',['data-c','data-s','data-n','data-v','data-type']),('.hbar-col',['class'])]:
            assert [[e.get(k) for k in attrs] for e in source.select(selector)]==[[e.get(k) for k in attrs] for e in target.select(selector)],(lang,str(rel),selector)
        # The new guide tables and release notes must retain every numeric value.
        selector='main' if str(rel).replace('\\','/') in ['pets/index.html','pet-tracker/index.html','dps-meters/index.html'] else '#soulbind' if str(rel).replace('\\','/')=='progression/index.html' else None
        if selector:
            def numbers(el):return Counter(re.findall(r'\d+(?:[.,:]\d+)*',el.get_text(' ',strip=True)))
            assert numbers(source.select_one(selector))==numbers(target.select_one(selector)),(lang,str(rel),'new content numbers')
        if str(rel).replace('\\','/') in ['cleric/index.html','sorcerer/index.html','ranger/index.html','assassin/index.html','templar/index.html','gladiator/index.html','weekly/index.html']:
            # Brazilian grouping/decimal punctuation may differ; values may not.
            def localized_numbers(el):
                values=re.findall(r'\d+(?:[.,:]\d+)*',el.get_text(' ',strip=True))
                return Counter(re.sub(r'[.,]','',v) if re.fullmatch(r'\d{1,3}(?:[.,]\d{3})+',v) else v.replace(',','.') for v in values)
            main=BeautifulSoup(str(source.main),'html.parser')
            for e in main.select('.suggest-box,.sec-vote,[data-helpful]'):e.decompose()
            assert localized_numbers(main)==localized_numbers(target.main),(lang,str(rel),'full guide numeric parity')
        # Macro order, timings and referenced skills retain the source structure.
        for selector in ['.macroseq .ms-n','.macroseq .ms-detail']:
            assert [e.get_text(strip=True) for e in source.select(selector)]==[e.get_text(strip=True) for e in target.select(selector)],(lang,str(rel),selector)
assert "var KEY = 'aion2-tracker-v1'" in (OUT/'assets/js/tracker.js').read_text(encoding='utf8')
print(json.dumps({'pages':len(pages),'missing_assets':0,'broken_links':0,'source_data_parity':'passed','tracker_storage':'preserved'}))
