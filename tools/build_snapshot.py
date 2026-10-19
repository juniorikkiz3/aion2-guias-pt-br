"""Build the independent EN/PT-BR edition from the current published-source snapshot.

The upstream public repository stopped updating on October 10. source-snapshot is
the October 19 public HTML/assets capture; translations are deterministic and local.
No remote translation, tracking or feedback service runs in the published edition.
"""
from pathlib import Path
from urllib.parse import urlparse,urljoin
import json,re,shutil,html
from bs4 import BeautifulSoup,NavigableString,Comment

ROOT=Path(__file__).resolve().parent.parent
SNAP=ROOT/'source-snapshot'
OUT=ROOT/'dist'
ORIGIN='https://aion2-guias-br.juniorikkix.chatgpt.site/'
SOURCE='https://aion2-guides.info/'
M=json.loads((ROOT/'translations/memory.json').read_text(encoding='utf8'))
if (ROOT/'translations/reviewed.json').exists(): M.update(json.loads((ROOT/'translations/reviewed.json').read_text(encoding='utf8')))
ATTRS=['title','aria-label','placeholder','data-empty','data-confirm','data-sending','data-ok','data-err','data-rate','data-short','data-clear','data-name','data-full','data-open','data-next','data-cd','data-active','data-stigma','data-passive']
SKIP={'id','slug','cls','kind','lang','root','url','href','icon','i','key','s','type','code','date','at','anchor','tz','source','name_en','sk','cls_slugs','guides','char_defaults'}
TEXT={'name','title','summary','text','label','description','desc','t','tip','units','months','cls_names','unlock_names','en','content','d','n','st','specs'}
untranslated=set()
def clean(s):return re.sub(r'\s+',' ',s).strip()
def tx(s):
    c=clean(s)
    if not c or not re.search('[A-Za-z]',c):return s
    result=M.get(c,c)
    if c not in M and re.search('[A-Za-z]{3}',c):untranslated.add(c)
    return s[:len(s)-len(s.lstrip())]+result+s[len(s.rstrip()):]
def jtx(x,scope=False):
    if isinstance(x,dict):return {k:(v if k in SKIP else jtx(v,scope or k in TEXT)) for k,v in x.items()}
    if isinstance(x,list):return [jtx(v,scope) for v in x]
    if isinstance(x,str) and scope:return tx(x)
    return x
def write(p,s):
    p=OUT/p;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(s,encoding='utf8')
def soupfrag(s):return BeautifulSoup(s,'html.parser')

def build_page(p,lang):
    rel=p.relative_to(SNAP/'en').parent.as_posix()
    rel='' if rel=='.' else rel+'/'
    depth=1+(rel.count('/') if rel else 0);base='../'*depth
    soup=BeautifulSoup(p.read_text(encoding='utf8'),'html.parser')
    soup.html['lang']=lang
    soup.html.attrs.pop('data-api',None)
    for selector in ['.feedback','.report-open','.suggest-box','.report-box','.sec-vote','[data-helpful]','.egg-star','.egg-dlg','.main-heart']:
        for el in soup.select(selector):el.decompose()
    for script in list(soup.find_all('script')):
        if script.get('type')=='application/json':continue
        if 'googletagmanager' in str(script) or 'gtag(' in str(script):script.decompose()
    for el in list(soup.find_all('link',rel='alternate')):el.decompose()
    for l in ['pt-BR','en','x-default']:
        el=soup.new_tag('link',rel='alternate',hreflang=l,href=ORIGIN+('pt-BR' if l=='x-default' else l)+'/'+rel);soup.head.append(el)
    canonical=ORIGIN+lang+'/'+rel
    soup.select_one('link[rel="canonical"]')['href']=canonical
    for meta in soup.find_all('meta'):
        if meta.get('property')=='og:url':meta['content']=canonical
        if meta.get('property')=='og:locale':meta['content']='pt_BR' if lang=='pt-BR' else 'en_US'
        if meta.get('property')=='og:site_name':meta['content']='AION 2 — Guias em Português'
        if meta.get('property')=='og:image':meta['content']=meta['content'].replace(SOURCE,ORIGIN)
        if lang=='pt-BR' and (meta.get('name')=='description' or meta.get('property') in ['og:title','og:description']):meta['content']=tx(meta['content'])
    for el in soup.find_all(True):
        for a in ['href','src','poster','data-index','data-base']:
            v=el.get(a)
            if not v:continue
            if v.startswith(SOURCE):v=v.replace(SOURCE,ORIGIN,1)
            if lang=='pt-BR':v=re.sub(r'(^|/)en/',r'\1pt-BR/',v)
            el[a]=v
        if el.get('data-lang')=='en':el['data-lang']=lang
    for script in soup.find_all('script',type='application/json'):
        sid=script.get('id')
        if sid=='lang-hint-data':
            cfg={'en':{'close':'Close','go':'Open in English','text':'This page is also available in English.'},'pt-BR':{'close':'Fechar','go':'Abrir em português','text':'Esta página também está disponível em português.'}}
        else:
            cfg=json.loads(script.string or '{}')
            if isinstance(cfg,dict) and cfg.get('lang')=='en':cfg['lang']=lang
            if lang=='pt-BR' and sid in ['up-cfg','tracker-config']:cfg=jtx(cfg)
            if sid=='tracker-config':
                cfg['char_defaults']=list(dict.fromkeys(cfg.get('char_defaults',[])+['Principal']))
            if lang=='pt-BR' and sid=='up-cfg':cfg['months']=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
        script.string=json.dumps(cfg,ensure_ascii=False,separators=(',',':')).replace('</','<\\/')
    if lang=='pt-BR':
        for n in list(soup.find_all(string=True)):
            if isinstance(n,Comment) or n.parent.name in ['script','style']:continue
            if clean(n):n.replace_with(tx(str(n)))
        for el in soup.find_all(True):
            for a in ATTRS:
                if el.get(a):el[a]=tx(el[a])
            if el.get('data-kinds'):el['data-kinds']=json.dumps(jtx(json.loads(el['data-kinds']),True),ensure_ascii=False)
    nav=soup.select_one('.lang-panel')
    if nav:
        for a in list(nav.find_all('a',hreflang=True)):a.decompose()
        for l,label,short in [('en','English','EN'),('pt-BR','Português do Brasil','PT')]:
            a=soup.new_tag('a',href=base+l+'/'+rel,hreflang=l,lang=l);a['data-keep-query']=''
            if l==lang:a['aria-current']='true'
            b=soup.new_tag('b');b.string=short;a.append(b);a.append(label);nav.insert(0,a)
        switch=soup.select_one('.lang-switch > span[aria-hidden]')
        if switch:
            tag=switch.select_one('.rg-tag');switch.clear();switch.append('PT' if lang=='pt-BR' else 'EN')
            if tag:switch.append(tag)
    brand=soup.select_one('.brand-text')
    if brand:
        brand.clear();brand.append(soupfrag('<b>AION 2</b><small>Guias em Português</small>' if lang=='pt-BR' else '<b>AION 2</b><small>Guides · Brazilian edition</small>'))
    footer=soup.select_one('.site-footer .footer-in > div')
    if footer:
        credit=footer.select_one('.foot-credit')
        if credit:credit.clear();credit.append(soupfrag('Edição independente em português baseada em <a href="https://aion2-guides.info/en/" target="_blank" rel="noopener">Couga54 / AION 2 Guides</a>. Créditos aos criadores nas fontes.' if lang=='pt-BR' else 'Independent Brazilian edition based on <a href="https://aion2-guides.info/en/" target="_blank" rel="noopener">Couga54 / AION 2 Guides</a>. Credit to the creators listed in Sources.'))
        notice=soup.new_tag('p');notice.string='Fonte atualizada até 18/10/2026 · Sincronizada em 19/10/2026. Tradução automática com revisão parcial; nomes do cliente Global preservados.' if lang=='pt-BR' else 'Source updated through Oct 18, 2026 · Synced Oct 19, 2026. Machine translation with partial review; Global client names preserved.'
        footer.append(notice)
    modal=soup.select_one('dialog.whatsnew:not(.feedback)')
    if modal:
        modal['data-id']='ptbr-source-2026-10-19'
        sec=modal.select_one('.wn-entry')
        if sec:
            sec.clear();sec.append(soupfrag('<time class="wn-date" datetime="2026-10-19">19 out 2026</time><ul><li>Guias sincronizados com a fonte até 18 de outubro: builds e macros revisadas, PvP de Assassino e Chanter, progressão após o nível 45, controle semanal e orçamento de cristais Daevanion.</li><li>Novidades do jogo e notas de patch disponíveis no menu lateral.</li></ul>' if lang=='pt-BR' else '<time class="wn-date" datetime="2026-10-19">Oct 19, 2026</time><ul><li>Synced with the source through Oct 18: updated builds and macros, Assassin and Chanter PvP, progression after 45, weekly tracker and Daevanion crystal budget.</li><li>Game news and patch notes available from the side tab.</li></ul>'))
    if rel=='changelog/':
        first=soup.select_one('.cl-entry')
        if first:first.insert_before(soupfrag('<section class="wn-entry cl-entry"><time class="wn-date" datetime="2026-10-19">19 out 2026</time><ul><li>Edição em português sincronizada com a fonte atualizada até 18/10/2026.</li></ul></section>' if lang=='pt-BR' else '<section class="wn-entry cl-entry"><time class="wn-date" datetime="2026-10-19">Oct 19, 2026</time><ul><li>Brazilian edition synced with the source through Oct 18, 2026.</li></ul></section>'))
    text=str(soup).replace('a7ef0001','ptbr20261019')
    write(lang+'/'+rel+'index.html',text)

def main():
    OUT.mkdir(exist_ok=True)
    shutil.copytree(ROOT/'src/assets',OUT/'assets',dirs_exist_ok=True)
    shutil.copytree(SNAP/'assets',OUT/'assets',dirs_exist_ok=True)
    if (SNAP/'favicon.ico').exists():shutil.copy2(SNAP/'favicon.ico',OUT/'favicon.ico')
    for p in sorted((SNAP/'en').rglob('index.html')):
        for lang in ['en','pt-BR']:build_page(p,lang)
    for lang in ['en','pt-BR']:
        for file in ['search.json','skill-tips.json']:
            cfg=json.loads((SNAP/'en'/file).read_text(encoding='utf8'))
            if lang=='pt-BR' and file=='search.json':
                for item in cfg:
                    for k in ['t','s']:
                        if item.get(k):item[k]=tx(item[k])
            write(lang+'/'+file,json.dumps(cfg,ensure_ascii=False,separators=(',',':')))
    js=OUT/'assets/js/site.js'
    data=js.read_text(encoding='utf8').replace("var LANGS = ['en', 'ru', 'uk', 'tr', 'ja'];","var LANGS = ['pt-BR', 'en'];")
    data=data.replace('(uk|tr|ja|ru|be)','(pt|en)').replace("want = first === 'be' ? 'ru' : first || 'en';","want = first === 'pt' ? 'pt-BR' : first || 'en';")
    data=data.replace("({ ru: 'ru-RU'","({ 'pt-BR': 'pt-BR', ru: 'ru-RU'").replace('(?:en|ru|uk|tr|ja)','(?:pt-BR|en)')
    js.write_text(data,encoding='utf8')
    write('index.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>AION 2 — Guias em Português</title><script>var l="pt-BR";try{if(localStorage.getItem("lang")==="en")l="en"}catch(e){}location.replace(l+"/"+location.search+location.hash)</script><a href="pt-BR/">Abrir os guias em português</a></html>')
    write('404.html','<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Página não encontrada — AION 2</title><body style="background:#0b0e14;color:#eee;font:20px system-ui;padding:10vw"><h1>Página não encontrada</h1><a style="color:#d9b36c" href="/pt-BR/">Voltar aos guias</a></body></html>')
    pages=[p.relative_to(OUT).as_posix().removesuffix('index.html') for lang in ['en','pt-BR'] for p in (OUT/lang).rglob('index.html')]
    write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+''.join('<url><loc>'+ORIGIN+p+'</loc><lastmod>2026-10-19</lastmod></url>' for p in pages)+'</urlset>')
    write('robots.txt','User-agent: *\nAllow: /\nSitemap: '+ORIGIN+'sitemap.xml\n')
    (ROOT/'translations/unmatched.json').write_text(json.dumps(sorted(untranslated),ensure_ascii=False,indent=2),encoding='utf8')
    print(f'Built {len(pages)} pages from current source snapshot; {len(untranslated)} untranslated fragments to inspect.')

if __name__=='__main__':main()
