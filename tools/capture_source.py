"""Capture the public source into a new candidate directory; never modifies the live snapshot."""
from pathlib import Path
from urllib.parse import urlparse,urljoin
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime,timezone
import argparse,hashlib,json,re,urllib.request,xml.etree.ElementTree as ET
from bs4 import BeautifulSoup

SOURCE='https://aion2-guides.info/'
def capture(destination):
    dest=Path(destination).resolve()
    if dest.exists() and any(dest.iterdir()):raise ValueError('Use an empty candidate directory, outside the checkout.')
    checkout=Path(__file__).resolve().parent.parent
    if dest==checkout or checkout in dest.parents:raise ValueError('Capture outside the checkout, then compare and review before applying.')
    dest.mkdir(parents=True,exist_ok=True)
    hashes={}
    def fetch(path):
        path=path.lstrip('/')
        if '..' in Path(path).parts:raise ValueError('Invalid source path')
        req=urllib.request.Request(SOURCE+path,headers={'User-Agent':'AION2-PTBR-maintenance/1.0'})
        with urllib.request.urlopen(req,timeout=45) as r:data=r.read()
        target=dest/path
        if path.endswith('/'):target=target/'index.html'
        target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data)
        hashes[target.relative_to(dest).as_posix()]=hashlib.sha256(data).hexdigest()
        return path,data
    _,sitemap=fetch('sitemap.xml')
    ns={'s':'http://www.sitemaps.org/schemas/sitemap/0.9'}
    pages=[];dates=[]
    for row in ET.fromstring(sitemap).findall('s:url',ns):
        url=row.findtext('s:loc',namespaces=ns) or '';p=urlparse(url)
        if p.netloc=='aion2-guides.info' and p.path.startswith('/en/'):
            pages.append(p.path.lstrip('/'));dates.append(row.findtext('s:lastmod',default='',namespaces=ns))
    if not pages:raise ValueError('Source sitemap contains no English pages')
    assets={'en/search.json','en/skill-tips.json','favicon.ico'}
    with ThreadPoolExecutor(max_workers=6) as pool:
        for page,data in pool.map(fetch,pages):
            raw=data.decode('utf8');soup=BeautifulSoup(raw,'html.parser')
            for el in soup.find_all(True):
                for attr in ['src','href','data-index','poster']:
                    value=el.get(attr,'');parsed=urlparse(urljoin(SOURCE+page,value))
                    if parsed.netloc=='aion2-guides.info' and parsed.path.startswith('/assets/'):assets.add(parsed.path.lstrip('/'))
            assets.update(re.findall(r'assets/[A-Za-z0-9_./-]+\.(?:webp|png|jpg|svg|ico|woff2)',raw.replace('\\/','/')))
    with ThreadPoolExecutor(max_workers=8) as pool:list(pool.map(fetch,sorted(assets)))
    # Download images/fonts referenced only by CSS too.
    extra=set()
    for css in (dest/'assets').rglob('*.css'):
        for value in re.findall(r'url\([\'"]?([^\)\'\"]+)',css.read_text(encoding='utf8')):
            p=urlparse(urljoin(SOURCE+css.relative_to(dest).as_posix(),value))
            if p.netloc=='aion2-guides.info' and p.path.startswith('/assets/'):extra.add(p.path.lstrip('/'))
    with ThreadPoolExecutor(max_workers=6) as pool:list(pool.map(fetch,sorted(extra-assets)))
    now=datetime.now(timezone.utc).isoformat()
    manifest={'source':SOURCE,'checked_at':now,'checked':now[:10],'source_updated':max(dates),'pages':pages,'assets':sorted(assets|extra),'sha256':dict(sorted(hashes.items())),'page_sha256':{p:h for p,h in hashes.items() if p.endswith('index.html')},'errors':[]}
    (dest/'provenance.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({'candidate':str(dest),'pages':len(pages),'assets':len(assets|extra),'source_updated':max(dates)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--destination',required=True)
    capture(parser.parse_args().destination)
