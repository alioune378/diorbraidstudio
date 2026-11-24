#!/usr/bin/env python3
"""Dior Braid Studio — static site generator.

Reads content/site.json (business content, edited from /admin) and
content/i18n.json (interface text, FR + EN) and writes the bilingual
site into dist/. Runs as the Netlify build command: `python3 build.py`.
Standard library only.
"""
import json, os, shutil, html, re
from datetime import date

ROOT = os.path.dirname(os.path.abspath(__file__))
DIST = os.path.join(ROOT, "dist")
S = json.load(open(os.path.join(ROOT, "content/site.json"), encoding="utf-8"))
T = json.load(open(os.path.join(ROOT, "content/i18n.json"), encoding="utf-8"))
LANGS = ["fr", "en"]
ROUTES = {  # page id -> slug per language
    "home":     {"fr": "",            "en": ""},
    "atelier":  {"fr": "atelier",     "en": "atelier"},
    "services": {"fr": "prestations", "en": "services"},
    "gallery":  {"fr": "galerie",     "en": "gallery"},
    "booking":  {"fr": "reservation", "en": "booking"},
    "journal":  {"fr": "conseils",    "en": "journal"},
}
NAV = ["home", "atelier", "services", "gallery", "journal"]
BASE = S["business"]["site_url"].rstrip("/")
B = S["business"]
BK = S["booking"]
ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"]
V = str(int(os.path.getmtime(os.path.join(ROOT, "static/assets/css/site.css"))))


def e(s):
    return html.escape(str(s or ""), quote=True)


def tr(obj, l):
    """Pick the language from a {fr,en} object (falls back to FR)."""
    if isinstance(obj, dict):
        return obj.get(l) or obj.get("fr") or ""
    return obj or ""


def ready(obj):
    return isinstance(obj, dict) and obj.get("status", "READY") == "READY"


def url(page, l):
    s = ROUTES[page][l]
    return f"/{l}/" + (s + "/" if s else "")


def money(v, l):
    if v is None or v == "":
        return None
    v = float(v)
    n = f"{v:,.0f}" if v == int(v) else f"{v:,.2f}"
    return (n.replace(",", " ") + " $") if l == "fr" else ("$" + n)


def dur(m, l):
    if not m:
        return None
    h, mi = divmod(int(m), 60)
    if l == "fr":
        return (f"{h} h" if h else "") + (f" {mi:02d}" if h and mi else (f"{mi} min" if mi else ""))
    return (f"{h}h" if h else "") + (f" {mi}min" if mi else "")


def svc_list():
    return [s for s in S["services"] if s.get("status", "READY") == "READY"]


def svc_price(s, l):
    prices = [s.get("price_cad")] + [v.get("price_cad") for v in s.get("variations", []) if v.get("status", "READY") == "READY"]
    prices = [p for p in prices if p not in (None, "")]
    if not prices:
        return T[l]["price_pending"]
    return f'{T[l]["from"]} {money(min(prices), l)}'


def svc_dur(s, l):
    return dur(s.get("duration_min"), l) or T[l]["duration_pending"]


def location_text(l):
    loc = B["location"]
    if loc.get("display_mode") == "street" and ready(loc.get("street_address")) and loc["street_address"].get("value"):
        return f'{loc["street_address"]["value"]}, {loc["city"]}'
    return loc["city"]


def hours_text(l):
    h = B.get("hours", {})
    return tr(h.get("text"), l) if ready(h) and tr(h.get("text"), l) else T[l]["by_appointment"]


def whatsapp():
    w = B.get("whatsapp", {})
    return f'https://wa.me/{w["number"]}' if ready(w) and w.get("number") else None


def socials():
    return [s for s in B.get("social", []) if ready(s) and s.get("url")]



GO = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'



# ------------------------------------------------------------------ shared bits
NAV = ["home", "services", "atelier", "gallery", "booking"]
INSP = bool(S.get("inspiration_images", {}).get("enabled"))
ARR = '<svg width="20" height="10" viewBox="0 0 20 10" aria-hidden="true"><path d="M0 5h18M14 1l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
GO = '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
PIN = '<svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true"><path d="M7 1a6 6 0 0 1 6 6c0 4.4-6 10-6 10S1 11.4 1 7a6 6 0 0 1 6-6zm0 3.6A2.4 2.4 0 1 0 7 9.4 2.4 2.4 0 0 0 7 4.6z" fill="#B88A3E"/></svg>'
CAL = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><rect x="2" y="3.5" width="14" height="12.5" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M2 7.5h14M6 1.5v4M12 1.5v4" stroke="currentColor" stroke-width="1.3"/></svg>'
TAG = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M10.5 2H17v6.5L9 16.5 2.5 10z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="13.5" cy="5.5" r="1.3" fill="currentColor"/></svg>'
HOUR = '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 2h10M5 18h10M6 2c0 5 8 5 8 8s-8 3-8 8M14 2c0 5-8 5-8 8s8 3 8 8" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
MAIL = '<svg width="18" height="14" viewBox="0 0 18 14" aria-hidden="true"><rect x="1" y="1" width="16" height="12" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M1.5 1.8 9 8l7.5-6.2" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>'
TICK = '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9l5-6" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>'
ICO = {  # summary icons
    "service": '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M4 1c0 4 3 4 3 8s-3 4-3 6M8 1c0 4 3 4 3 8s-3 4-3 6M12 1c0 4 2 4 2 8" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
    "style": '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12" r="2.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 10 13 1M10.5 10 3 1" stroke="currentColor" stroke-width="1.2"/></svg>',
    "length": '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 1v14M8 1v10M13 1v6" stroke="currentColor" stroke-width="1.2"/></svg>',
    "options": '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M8 4.5v7M4.5 8h7" stroke="currentColor" stroke-width="1.2"/></svg>',
    "date": CAL,
}


def t(l, k):
    return T[l][k]


def img_tag(src, alt, cls="", lazy=True, sizes=None, insp=False, l="fr", w=720, h=960):
    tag = f'<span class="tag-insp">{e(T[l]["insp_tag"])}</span>' if (insp and INSP) else ""
    return f'<img src="{e(src)}" alt="{e(alt)}" width="{w}" height="{h}"{" loading=lazy" if lazy else ""} decoding="async">{tag}'


def is_insp(src):
    return "/inspiration/" in (src or "")


def svc_img(s):
    return s.get("image") or "/assets/studio/studio-m.webp"


def langs(page, l):
    alt = "en" if l == "fr" else "fr"
    target = url(page or "home", alt)
    cur = f'<span aria-current="true" lang="{l}">{l.upper()}</span>'
    oth = f'<a href="{target}" hreflang="{alt}" lang="{alt}" data-lang="{alt}" aria-label="{e(T[l]["lang_switch"])}">{alt.upper()}</a>'
    return f'<div class="langs" role="group" aria-label="Langue / Language">{cur if l == "fr" else oth}{oth if l == "fr" else cur}</div>'


def ribbon(cls):
    return f'<img class="ribbon {cls}" src="/assets/brand/ribbon.svg" alt="" width="400" height="300" aria-hidden="true">'


def gallery_items():
    return [g for g in S["gallery"]["items"] if g.get("status", "READY") == "READY" and g.get("image")]


def gallery_json(l):
    names = {s["id"]: tr(s["name"], l) for s in S["services"]}
    return json.dumps([{"src": g["image"], "cap": tr(g.get("caption"), l), "alt": tr(g.get("alt"), l) or tr(g.get("caption"), l),
                        "cat": names.get(g.get("category"), ""), "insp": bool(g.get("inspiration") and INSP)} for g in gallery_items()], ensure_ascii=False)


def lightbox(l):
    return f"""<div class="lb" id="lb" role="dialog" aria-modal="true" aria-label="{e(t(l, 'nav_gallery'))}" hidden>
 <button class="lb-btn lb-x" type="button" aria-label="{e(t(l, 'close'))}">&times;</button>
 <button class="lb-btn lb-p" type="button" aria-label="{e(t(l, 'prev'))}">&#8249;</button>
 <figure><img alt=""><figcaption></figcaption></figure>
 <button class="lb-btn lb-n" type="button" aria-label="{e(t(l, 'next'))}">&#8250;</button>
 <div class="count" aria-live="polite"></div>
</div>
<script id="gal-data" type="application/json">{gallery_json(l)}</script>"""


# ------------------------------------------------------------------ layout
def head(page, l, title, desc):
    canon = BASE + url(page, l)
    ld = {"@context": "https://schema.org", "@type": "BeautySalon", "name": B["name"], "url": BASE + url("home", l),
          "telephone": B["phone_href"], "email": B["email"], "image": BASE + "/assets/brand/og.jpg", "logo": BASE + "/assets/brand/logo-full.png",
          "address": {"@type": "PostalAddress", "addressLocality": "Laval", "addressRegion": "QC", "addressCountry": "CA"},
          "priceRange": "$$", "sameAs": [s["url"] for s in socials()]}
    robots = '<meta name="robots" content="noindex,nofollow">' if INSP else '<meta name="robots" content="index,follow">'
    return f"""<!doctype html>
<html lang="{l}-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
{robots}
<link rel="canonical" href="{canon}">
<link rel="alternate" hreflang="fr-CA" href="{BASE + url(page, 'fr')}">
<link rel="alternate" hreflang="en-CA" href="{BASE + url(page, 'en')}">
<link rel="alternate" hreflang="x-default" href="{BASE + url(page, 'fr')}">
<meta property="og:type" content="website"><meta property="og:site_name" content="{e(B['name'])}">
<meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}"><meta property="og:image" content="{BASE}/assets/brand/og.jpg">
<meta property="og:locale" content="{'fr_CA' if l == 'fr' else 'en_CA'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2B1810">
<link rel="icon" href="/assets/brand/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&family=Playfair+Display:ital,wght@0,500;1,500&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v={V}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
"""


def header(page, l):
    links = "".join(f'<a href="{url(p, l)}"{" aria-current=page" if p == page else ""}>{e(t(l, "nav_" + p))}</a>' for p in NAV)
    dl = "".join(f'<a href="{url(p, l)}"{" aria-current=page" if p == page else ""}>{e(t(l, "nav_" + p))}</a>' for p in NAV + ["journal"])
    wa = whatsapp()
    return f"""<body data-page="{page}" data-lang="{l}">
<a class="skip" href="#main">{e(t(l, 'skip'))}</a>
<header class="hdr" id="hdr"><div class="wrap">
 <div class="bar">
  <a class="brand" href="{url('home', l)}" aria-label="{e(B['name'])} — {e(t(l, 'nav_home'))}"><picture><source srcset="/assets/brand/logo-nav.webp" type="image/webp"><img src="/assets/brand/logo-nav.png" alt="{e(B['name'])}" width="520" height="461"></picture></a>
  <nav class="nav" aria-label="Navigation">{links}</nav>
  {langs(page, l)}
  <button class="burger" type="button" aria-controls="drawer" aria-expanded="false" aria-label="{e(t(l, 'menu'))}"><i></i></button>
 </div>
</div></header>
<div class="drawer esp" id="drawer" role="dialog" aria-modal="true" aria-label="{e(t(l, 'menu'))}" hidden>
 <div class="drawer-top"><img src="/assets/brand/logo-nav-white.png" alt="{e(B['name'])}" width="520" height="461"><button class="x" type="button" aria-label="{e(t(l, 'close'))}">&times;</button></div>
 <nav aria-label="Menu">{dl}</nav>
 <div class="foot">
  <a class="btn" href="{url('booking', l)}">{e(t(l, 'cta_book'))} {ARR}</a>
  <a href="tel:{B['phone_href']}">{e(B['phone'])}</a>
  <a href="mailto:{B['email']}">{e(B['email'])}</a>
  {f'<a href="{wa}" rel="noopener">WhatsApp</a>' if wa else ''}
  <span>{e(location_text(l))} · {e(hours_text(l))}</span>
 </div>
</div>
<main id="main">
"""


def footer(page, l):
    wa = whatsapp()
    soc = " · ".join(f'<a href="{e(s["url"])}" rel="noopener">{e(s["network"])}</a>' for s in socials())
    nav = "".join(f'<a href="{url(p, l)}">{e(t(l, "nav_" + p))}</a>' for p in NAV + ["journal"])
    cr = S["credit"]
    return f"""</main>
<footer class="foot-s esp">
 <div class="wrap">
  <div class="foot-grid">
   <div class="fl"><img class="logo" src="/assets/brand/logo-full-white.png" alt="{e(B['name'])} — Luxury Braiding Experience" width="900" height="888" loading="lazy"></div>
   <div><h4>{e(t(l, 'contact_title'))}</h4><p><a href="tel:{B['phone_href']}">{e(B['phone'])}</a></p><p><a href="mailto:{B['email']}">{e(B['email'])}</a></p>{f'<p><a href="{wa}" rel="noopener">WhatsApp</a></p>' if wa else ''}{f'<p>{soc}</p>' if soc else ''}</div>
   <div><h4>{e(t(l, 'location_label'))}</h4><p>{e(location_text(l))}</p><p>{e(t(l, 'footer_note'))}</p><h4 style="margin-top:18px">{e(t(l, 'hours_label'))}</h4><p>{e(hours_text(l))}</p></div>
   <div><h4>Navigation</h4><nav aria-label="Footer">{nav}</nav></div>
  </div>
  <div class="foot-b"><span>© {date.today().year} {e(B['name'])}</span><span>{e(t(l, 'credit'))} <a href="{e(cr['url'])}" rel="noopener">{e(cr['name'])}</a></span></div>
 </div>
</footer>
<script src="/assets/js/site.js?v={V}" defer></script>
</body>
</html>
"""


def final_cta(l):
    return f"""
<section class="final marble">
 {ribbon('r-tl')}{ribbon('r-br')}
 <div class="wrap rv">
  <h2 class="h">{t(l, 'final_title')}</h2>
  <p class="sub">{e(t(l, 'final_text'))}</p>
  <a class="btn" href="{url('booking', l)}">{CAL} {e(t(l, 'cta_book'))} {ARR}</a>
 </div>
</section>"""


def svc_cards(l, href_fn):
    out = []
    for s in svc_list():
        alt_name = tr(s["name"], "en" if l == "fr" else "fr")
        out.append(f"""<a class="card" href="{href_fn(s)}"><div class="arch">{img_tag(svc_img(s), tr(s['name'], l), insp=is_insp(svc_img(s)), l=l)}</div>
<span class="cap"><b>{e(tr(s['name'], l))}</b>{f'<small>{e(alt_name)}</small>' if alt_name != tr(s['name'], l) else ''}<span class="price">{e(svc_price(s, l))}</span><span class="go">{GO}</span></span></a>""")
    return "".join(out)


# ------------------------------------------------------------------ pages
def page_home(l):
    h, sig = S["home"], S["signature"]
    items = gallery_items()[:6]
    rail = "".join(f'<button type="button" data-lb="{i}" aria-label="{e(tr(g.get("caption"), l))}"><span class="arch" style="display:block">{img_tag(g.get("thumb") or g["image"], tr(g.get("alt"), l), insp=g.get("inspiration"), l=l, w=400, h=530)}</span></button>' for i, g in enumerate(items))
    diamonds = "".join(f'<li><a href="{url("services", l)}#{s["id"]}">{e(tr(s["name"], l))}</a></li>' for s in svc_list())
    pillars = "".join(f'<div class="pillar rv"><span class="fleuron" style="width:60px;margin:0 auto"></span><h3>{e(tr(p, l))}</h3><p>{e(tr(p["text"], l))}</p></div>' for p in sig["pillars"])
    return f"""
<section class="hero marble">
 {ribbon('r-tl')}
 <div class="wrap hero-grid">
  <div class="hero-copy rv">
   <h1 class="h">{h['hero_title'][l]}</h1>
   <span class="rule"></span>
   <p class="sub">{e(tr(h['hero_sub'], l))}</p>
   <p class="txt">{e(tr(h['hero_text'], l))}</p>
   <div class="hero-cta"><a class="btn" href="{url('booking', l)}">{e(t(l, 'cta_book'))} {ARR}</a><span class="loc">{PIN} Laval, Québec</span></div>
  </div>
  <div class="hero-photo">
   <div class="arch-frame"><div class="arch"><picture><source media="(max-width:720px)" srcset="/assets/studio/studio-m.webp"><img src="/assets/studio/studio-l.webp" alt="{e(t(l, 'studio_alt'))}" width="1086" height="1448" fetchpriority="high"></picture></div></div>
   <img class="leaf" src="/assets/brand/leaf.svg" alt="" width="120" height="200" aria-hidden="true">
  </div>
 </div>
</section>

<section class="herit esp">
 <div class="wrap herit-grid">
  <div class="herit-portrait">{img_tag(h.get('heritage_image', ''), t(l, 'heritage_alt'), insp=is_insp(h.get('heritage_image')), l=l)}</div>
  <div class="herit-head rv center"><span class="k both">{e(t(l, 'story_kicker'))}</span><h2 class="h" style="margin-top:12px">{t(l, 'heritage_title')}</h2><span class="fleuron"></span></div>
  <span class="vline"></span>
  <div class="herit-text rv"><p class="txt">{e(tr(S['founder']['bio'], l))}</p><a class="more" href="{url('atelier', l)}">{e(t(l, 'discover_story'))} {GO}</a></div>
 </div>
</section>

<section class="intro marble">
 <div class="wrap intro-grid">
  <div class="rv"><span class="k">{e(t(l, 'services_kicker'))}</span><h2 class="h" style="margin-top:10px">{t(l, 'services_title')}</h2></div>
  <span class="vline"></span>
  <p class="txt intro-txt rv" style="font-style:italic">{e(t(l, 'services_intro'))}</p>
  <span class="vline second"></span>
  <ul class="diamonds rv">{diamonds}</ul>
 </div>
</section>

<section class="svc-band esp">
 <div class="wrap">
  <div class="band-title"><span class="k" style="gap:0">{e(t(l, 'services_main'))}</span></div>
  <div class="cards">{svc_cards(l, lambda s: url('services', l) + '#' + s['id'])}</div>
 </div>
</section>

<section class="sig marble">
 <div class="wrap">
  <div class="sig-grid">
   <div class="sig-img">{img_tag(sig.get('image', ''), t(l, 'signature_alt'), insp=is_insp(sig.get('image')), l=l)}</div>
   <div class="rv"><span class="k">{e(tr(sig['title'], l))}</span><h2 class="h" style="margin-top:10px">{tr(sig['headline'], l)}</h2></div>
   <span class="lotus" aria-hidden="true"></span>
   <div class="sig-q rv"><p class="txt">{e(tr(sig['quote'], l))}</p></div>
  </div>
  <div class="pillars">{pillars}</div>
 </div>
</section>

<section class="look esp">
 <div class="wrap look-grid">
  <div class="look-head"><div><span class="k">{e(t(l, 'nav_gallery'))}</span><h2 class="h" style="margin-top:8px">{t(l, 'lookbook_title')}</h2></div></div>
  <span class="vline"></span>
  <p class="txt">{e(t(l, 'lookbook_text'))}</p>
  <div class="rail">{rail}</div>
 </div>
 <div class="wrap" style="text-align:right;margin-top:12px"><a class="more" href="{url('gallery', l)}">{e(t(l, 'see_gallery'))} {GO}</a></div>
</section>
{lightbox(l)}
""" + final_cta(l)


def phero(l, kicker, title, sub, text, cta_html, img_html):
    return f"""
<section class="phero marble">
 {ribbon('r-tl')}
 <div class="wrap phero-grid">
  <div class="phero-copy rv">
   {f'<span class="k">{e(kicker)}</span>' if kicker else ''}
   <h1 class="h" style="margin-top:10px">{title}</h1>
   {f'<p class="sub">{e(sub)}</p>' if sub else ''}
   {f'<p class="txt">{e(text)}</p>' if text else ''}
   {cta_html}
  </div>
  <div class="arch-frame">{img_html}</div>
 </div>
</section>"""


STUDIO_ARCH = lambda l: f'<div class="arch"><picture><source media="(max-width:720px)" srcset="/assets/studio/studio-m.webp"><img src="/assets/studio/studio-l.webp" alt="{e(t(l, "studio_alt"))}" width="1086" height="1448"></picture></div>'


def page_services(l):
    det = []
    for i, s in enumerate(svc_list()):
        vars_ = [v for v in s.get("variations", []) if v.get("status", "READY") == "READY"]
        chips = "".join(f'<span class="chip">{e(tr(v["name"], l))}{(" · " + e(money(v.get("price_cad"), l))) if v.get("price_cad") not in (None, "") else ""}</span>' for v in vars_)
        prep = s.get("preparation", {})
        prep_txt = tr(prep, l) if ready(prep) and tr(prep, l) else t(l, "prep_pending")
        det.append(f"""
<article class="sd rv" id="{s['id']}">
 <div class="sd-media"><div class="arch-frame"><div class="arch">{img_tag(svc_img(s), tr(s['name'], l), insp=is_insp(svc_img(s)), l=l)}</div></div></div>
 <div class="sd-body">
  <div class="sd-head"><span class="num">{ROMAN[i]}</span><h2>{e(tr(s['name'], l))}</h2><p class="txt">{e(tr(s['description'], l))}</p></div>
  {f'<div class="chips" aria-label="{e(t(l, "variation_label"))}">{chips}</div>' if chips else f'<p class="note">{e(t(l, "variations_pending"))}</p>'}
  <dl class="facts"><div>{TAG}<span><dt>{e(t(l, 'price_label'))}</dt><dd>{e(svc_price(s, l))}</dd></span></div><div>{HOUR}<span><dt>{e(t(l, 'duration_label'))}</dt><dd>{e(svc_dur(s, l))}</dd></span></div></dl>
  <p class="note"><strong>{e(t(l, 'prep_label'))} —</strong> {e(prep_txt)}</p>
  <div class="sd-cta"><a class="btn small" href="{url('booking', l)}?service={s['id']}">{e(t(l, 'book_this'))} {ARR}</a></div>
 </div>
</article>""")
    svc_opts = "".join(f'<option value="{s["id"]}">{e(tr(s["name"], l))}</option>' for s in svc_list())
    lens = "".join(f'<option>{e(t(l, k))}</option>' for k in ["len_short", "len_medium", "len_long", "len_xlong"])
    addons = sorted({tr(a["name"], l) for s in svc_list() for a in s.get("addons", []) if a.get("status", "READY") == "READY"}, key=lambda x: x)
    first = svc_list()[0]
    addon_names = [tr(a["name"], l) for a in first.get("addons", [])] or addons
    opts = "".join(f'<label><input type="checkbox" name="addons" value="{e(a)}"> {e(a)}</label>' for a in addon_names)
    return phero(l, t(l, "services_kicker"), t(l, "services_page_title"), t(l, "services_page_sub"), t(l, "services_page_intro"),
                 f'<div class="hero-cta"><a class="btn" href="#estimateur">{e(t(l, "estimator_cta"))} {ARR}</a><span class="loc">{PIN} Laval, Québec</span></div>', STUDIO_ARCH(l)) + f"""
<section class="svc-band esp">
 <div class="wrap">
  <div class="band-title"><span class="k" style="gap:0">{e(t(l, 'services_main'))}</span></div>
  <div class="cards">{svc_cards(l, lambda s: '#' + s['id'])}</div>
 </div>
</section>
<section class="svc-detail"><div class="wrap">{''.join(det)}{policies(l)}</div></section>
<section class="est marble" id="estimateur">
 {ribbon('r-tl')}
 <div class="wrap">
  <div class="center rv"><h2 class="h" style="font-size:clamp(32px,4.4vw,60px)">{t(l, 'estimator_title')}</h2><p class="sub" style="margin-top:8px">{e(t(l, 'estimator_sub'))}</p><span class="fleuron"></span></div>
  <form class="est-form" id="est" action="{url('booking', l)}" method="get">
   <div class="est-cols">
    <div class="est-col"><span class="medal">01</span><h3>{e(t(l, 'step_service'))}</h3><p>{e(t(l, 'choose_service'))}</p><select class="sel" name="service" aria-label="{e(t(l, 'step_service'))}">{svc_opts}</select></div>
    <div class="est-col"><span class="medal">02</span><h3>{e(t(l, 'step_style'))}</h3><p>{e(t(l, 'choose_variation'))}</p><select class="sel" name="variation" aria-label="{e(t(l, 'variation_label'))}"></select></div>
    <div class="est-col"><span class="medal">03</span><h3>{e(t(l, 'length_label'))}</h3><p>{e(t(l, 'choose_length'))}</p><select class="sel" name="length" aria-label="{e(t(l, 'length_label'))}"><option value="">{e(t(l, 'select_ph'))}</option>{lens}</select></div>
    <div class="est-col"><span class="medal">04</span><h3>{e(t(l, 'addons_label'))}</h3><p>{e(t(l, 'addons_optional'))}</p><div class="opts">{opts}</div></div>
   </div>
   <div class="est-foot"><button class="btn" type="submit">{CAL} {e(t(l, 'estimate_go'))} {ARR}</button><div class="meta"><span id="est-price">{e(t(l, 'price_pending'))}</span><span aria-hidden="true">|</span><span id="est-dur">{e(t(l, 'duration_pending'))}</span></div></div>
  </form>
 </div>
</section>
<script id="svc-data" type="application/json">{json.dumps(svc_payload(l), ensure_ascii=False)}</script>
""" + final_cta(l)


def svc_payload(l):
    out = []
    for s in svc_list():
        out.append({"id": s["id"], "name": tr(s["name"], l), "price": s.get("price_cad"), "dur": s.get("duration_min"), "img": svc_img(s),
                    "sizes": s.get("sizes", True), "lengths": s.get("lengths", True),
                    "variations": [{"name": tr(v["name"], l), "price": v.get("price_cad"), "dur": v.get("duration_min")} for v in s.get("variations", []) if v.get("status", "READY") == "READY"],
                    "addons": [{"name": tr(a["name"], l), "price": a.get("price_cad")} for a in s.get("addons", []) if a.get("status", "READY") == "READY"]})
    return out


def policies(l):
    dep, can = BK.get("deposit", {}), BK.get("cancellation_policy", {})
    rows = ""
    if ready(dep) and tr(dep.get("text"), l):
        rows += f'<div><span><dt>{e(t(l, "deposit_label"))}</dt><dd>{e(tr(dep["text"], l))}</dd></span></div>'
    if ready(can) and tr(can.get("text"), l):
        rows += f'<div><span><dt>{e(t(l, "cancel_label"))}</dt><dd>{e(tr(can["text"], l))}</dd></span></div>'
    if not rows:
        return ""  # never invent policies
    return f'<div class="sd" style="display:block"><span class="k">{e(t(l, "policies_title"))}</span><dl class="facts">{rows}</dl></div>'


def page_gallery(l):
    names = {s["id"]: tr(s["name"], l) for s in S["services"]}
    items = gallery_items()
    present = [c for c in S["gallery"]["categories"] if any(g.get("category") == c for g in items)]
    btns = f'<button type="button" aria-pressed="true" data-f="all">{e(t(l, "filter_all"))}</button>' + "".join(
        f'<button type="button" aria-pressed="false" data-f="{c}">{e(names.get(c, c))}</button>' for c in present)
    figs = "".join(f"""<figure class="g-item" data-c="{e(g.get('category', ''))}"><button type="button" data-lb="{i}" aria-label="{e(t(l, 'enlarge'))} — {e(tr(g.get('caption'), l))}"><span class="arch" style="display:block">{img_tag(g['image'], tr(g.get('alt'), l), insp=g.get('inspiration'), l=l)}</span></button><figcaption>{e(tr(g.get('caption'), l))}</figcaption></figure>""" for i, g in enumerate(items))
    empty = f'<p class="g-empty">{e(t(l, "gallery_empty"))}</p>' if not items else ""
    note = f'<p class="upload-note">{e(t(l, "insp_note"))}</p>' if INSP and any(g.get("inspiration") for g in items) else ""
    first = items[0]["image"] if items else "/assets/studio/studio-m.webp"
    return phero(l, t(l, "lookbook_kicker"), t(l, "lookbook_title"), t(l, "gallery_sub"), t(l, "lookbook_text"),
                 f'<div class="hero-cta"><a class="btn" href="{url("booking", l)}">{e(t(l, "cta_book"))} {ARR}</a></div>',
                 f'<div class="arch">{img_tag(first, t(l, "nav_gallery"), insp=is_insp(first), l=l, lazy=False)}</div>') + f"""
<section class="gal"><div class="wrap">
 <div class="filters" role="toolbar" aria-label="{e(t(l, 'filter_label'))}">{btns}</div>
 <div class="g-grid" id="gallery">{figs}</div>
 <p class="g-count" id="g-count" aria-live="polite"></p>
 {empty}{note}
</div></section>
{lightbox(l)}
""" + final_cta(l)


def page_atelier(l):
    f, sig = S["founder"], S["signature"]
    portrait = f.get("portrait", {})
    pimg = portrait["src"] if ready(portrait) and portrait.get("src") else S["home"].get("heritage_image", "/assets/studio/studio-m.webp")
    pillars = "".join(f'<div class="pillar rv"><span class="fleuron" style="width:60px;margin:0 auto"></span><h3>{e(tr(p, l))}</h3><p>{e(tr(p["text"], l))}</p></div>' for p in sig["pillars"])
    return phero(l, t(l, "story_kicker"), t(l, "heritage_title"), t(l, "story_sub"), "",
                 f'<div class="hero-cta"><a class="btn" href="{url("booking", l)}">{e(t(l, "cta_book"))} {ARR}</a><span class="loc">{PIN} Laval, Québec</span></div>', STUDIO_ARCH(l)) + f"""
<section class="story"><div class="wrap story-grid">
 <div class="arch-frame rv" style="max-width:440px;width:100%;margin-inline:auto"><div class="arch" style="aspect-ratio:3/3.9">{img_tag(pimg, t(l, 'heritage_alt'), insp=is_insp(pimg), l=l)}</div></div>
 <div class="rv">
  <span class="k">{e(t(l, 'founder_kicker'))}</span>
  <p class="big">{e(tr(f['bio'], l))}</p>
  <div class="stats"><div class="stat"><b>{S['home']['years']}+</b><span>{e(t(l, 'years_label'))}</span></div><div class="stat"><b>Laval</b><span>{e(t(l, 'private_studio'))}</span></div><div class="stat"><b>FR · EN</b><span>{e(t(l, 'languages_label'))}</span></div></div>
 </div>
</div></section>
<section class="sig esp"><div class="wrap center">
 <span class="k both">{e(tr(sig['title'], l))}</span>
 <h2 class="h" style="margin:12px auto 0;max-width:900px;font-size:clamp(28px,3.6vw,50px)">{tr(sig['headline'], l)}</h2>
 <span class="fleuron"></span>
 <p class="txt" style="max-width:760px;margin:0 auto">{e(tr(sig['quote'], l))}</p>
 <div class="pillars" style="text-align:center">{pillars}</div>
</div></section>
<section class="studio-band marble">{ribbon('r-br')}<div class="wrap grid">
 <div class="ph rv"><img src="/assets/studio/studio-l.webp" alt="{e(t(l, 'studio_alt'))}" width="1086" height="1448" loading="lazy"></div>
 <div class="rv"><span class="k">{e(t(l, 'studio_kicker'))}</span><h2 class="h" style="margin-top:10px;font-size:clamp(30px,3.6vw,50px)">{t(l, 'atelier_title')}</h2><span class="fleuron"></span><p class="txt">{e(t(l, 'atelier_text'))}</p><p class="txt" style="margin-top:10px">{e(t(l, 'studio_text'))}</p></div>
</div></section>
""" + final_cta(l)


def page_journal(l):
    arts = [a for a in S["journal"].get("articles", []) if a.get("status") == "READY"]
    imgs = [g["thumb"] for g in gallery_items() if g.get("thumb")] or ["/assets/studio/studio-m.webp"]
    cards = "".join(f'<article class="jr-card rv"><div class="in"><div class="arch">{img_tag(imgs[i % len(imgs)], "", insp=False, l=l, w=400, h=530)}</div><div class="body"><span class="badge">{e(t(l, "journal_draft"))}</span><h3>{e(tr(x, l))}</h3></div></div></article>' for i, x in enumerate(S["journal"]["topics"]))
    body = "".join(f'<article class="sd" style="display:block"><h2>{e(tr(a["title"], l))}</h2><div class="txt">{tr(a.get("body"), l)}</div></article>' for a in arts)
    return phero(l, t(l, "journal_kicker"), t(l, "journal_title"), "", t(l, "journal_page_intro"), "", STUDIO_ARCH(l)) + f"""
<section class="jr"><div class="wrap">{body}<div class="jr-grid">{cards}</div></div></section>
""" + final_cta(l)


def page_booking(l):
    sched = BK.get("mode") == "scheduler" and BK.get("scheduler_url")
    data = svc_payload(l)
    pick = "".join(f"""<label><input type="radio" name="service" value="{e(s['name'])}" data-id="{s['id']}"><span class="pc"><span class="arch" style="display:block">{img_tag(s['img'].replace('-l.webp', '-s.webp') if ('/inspiration/' in s['img'] or '/work/' in s['img']) else s['img'], '', l=l, w=400, h=530)}</span><b>{e(s['name'])}</b><span class="tick">{TICK}</span></span></label>""" for s in data)

    def pills(name, keys, typ="radio"):
        return '<div class="pills">' + "".join(f'<label><input type="{typ}" name="{name}" value="{e(t(l, k))}"><span>{e(t(l, k))}</span></label>' for k in keys) + "</div>"
    today = date.today().isoformat()
    T_JS = {k: t(l, k) for k in ["price_pending", "duration_pending", "from", "summary_empty", "variation_none", "addons_none",
            "err_service", "err_name", "err_contact", "err_consent", "err_photo", "err_slot", "sending", "photo_yes",
            "summary_service", "summary_variation", "summary_style", "summary_length", "summary_size", "summary_addons", "summary_date",
            "name_label", "phone_label", "email_label", "notes_label", "status_request", "status_confirmed", "slot_taken",
            "no_slots", "pick_day", "pick_time", "loading", "consult_only", "continue", "send", "done_title", "done_text",
            "done_title_confirmed", "done_text_confirmed", "mobile_choose"]}
    cfg = {"lang": l, "services": data, "t": T_JS, "email": B["email"], "subject": t(l, "mail_subject"),
           "months": t(l, "months").split(","), "dows": t(l, "dows").split(",")}
    cfg_json = json.dumps(cfg, ensure_ascii=False).replace("</", "<" + chr(92) + "/")
    wa = whatsapp()
    sched_block = ""
    if sched:
        sched_block = f'<div class="notice">{CAL}<span>{e(t(l, "scheduler_note"))} <a href="{e(BK["scheduler_url"])}" target="_blank" rel="noopener">{e(t(l, "scheduler_cta"))}</a></span></div>'
    sumrows = "".join(f'<div data-row="{k}"><span>{ICO[k]}</span><dt>{e(t(l, "summary_" + ("service" if k == "service" else "variation" if k == "style" else "length" if k == "length" else "addons" if k == "options" else "date")))}</dt><dd>—</dd></div>' for k in ["service", "style", "length", "options", "date"])
    return phero(l, t(l, "by_appointment"), t(l, "booking_title"), t(l, "booking_sub"), t(l, "booking_intro"), "", STUDIO_ARCH(l)) + f"""
<section class="bk"><div class="wrap bk-grid">
 <div>
 {sched_block}
 <form id="bk" name="rendez-vous" method="POST" action="{url('booking', l)}?sent=1" data-netlify="true" netlify-honeypot="company" enctype="multipart/form-data" novalidate>
  <input type="hidden" name="form-name" value="rendez-vous">
  <input type="hidden" name="language" value="{l}">
  <input type="hidden" name="summary" value="">
  <input type="hidden" name="booking_status" value="">
  <input type="hidden" name="booking_id" value="">
  <input type="hidden" name="date" value=""><input type="hidden" name="time" value="">
  <p class="sr"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>

  <div class="step" id="s1"><div class="step-h"><span class="medal">01</span><div><h2>{e(t(l, 'step_service'))}</h2><p>{e(t(l, 'choose_service'))}</p></div></div>
   <fieldset style="border:0;margin:0;padding:0"><legend class="sr">{e(t(l, 'choose_service'))}</legend><div class="pick">{pick}</div></fieldset>
   <p class="err" id="e-service" role="alert"></p>
  </div>

  <div class="step" id="s2"><div class="step-h"><span class="medal">02</span><div><h2>{e(t(l, 'step_style'))}</h2><p>{e(t(l, 'style_step_sub'))}</p></div></div>
   <div class="grp" id="var-wrap"><span class="lab">{e(t(l, 'variation_label'))}</span><div class="pills" id="var-choices"><span class="hint">{e(t(l, 'choose_service_first'))}</span></div></div>
   <div class="grp" id="len-wrap"><span class="lab">{e(t(l, 'length_label'))}</span>{pills('length', ['len_short', 'len_medium', 'len_long', 'len_xlong'])}</div>
   <div class="grp" id="size-wrap"><span class="lab">{e(t(l, 'size_label'))}</span>{pills('size', ['size_small', 'size_medium', 'size_large'])}</div>
   <div class="grp"><span class="lab">{e(t(l, 'addons_label'))}</span><div class="pills" id="addon-choices"></div><p class="hint" id="addon-none">{e(t(l, 'addons_none'))}</p></div>
   <div class="field"><label for="f-style">{e(t(l, 'style_label'))}</label><textarea id="f-style" name="style" maxlength="800" placeholder="{e(t(l, 'style_ph'))}"></textarea></div>
   <div class="field"><label for="f-photo">{e(t(l, 'photo_label'))}</label><input id="f-photo" type="file" name="inspiration" accept="image/jpeg,image/png,image/webp,image/heic"><p class="hint">{e(t(l, 'photo_help'))}</p><p class="err" id="e-photo" role="alert"></p></div>
   <p class="hint">{e(t(l, 'pref_note'))}</p>
  </div>

  <div class="step" id="s3"><div class="step-h"><span class="medal">03</span><div><h2>{e(t(l, 'step_date'))}</h2><p id="date-sub">{e(t(l, 'date_step_sub'))}</p></div></div>
   <div id="slots" hidden>
    <div class="cal">
     <div><div class="cal-head"><button type="button" class="cal-nav" data-m="-1" aria-label="{e(t(l, 'prev'))}">&#8249;</button><b id="cal-title"></b><button type="button" class="cal-nav" data-m="1" aria-label="{e(t(l, 'next'))}">&#8250;</button></div><div class="cal-grid" id="cal-grid" role="grid"></div></div>
     <div><span class="lab" style="font-family:var(--label);font-size:11.5px;letter-spacing:.2em;text-transform:uppercase;color:var(--muted)" id="times-title">{e(t(l, 'pick_day'))}</span><div class="times" id="times" style="margin-top:10px"></div></div>
    </div>
   </div>
   <div id="pref">
    <div class="notice">{CAL}<span>{e(t(l, 'date_note'))}</span></div>
    <div class="field"><label for="f-date">{e(t(l, 'date_label'))}</label><input id="f-date" type="date" min="{today}"></div>
    <div class="grp"><span class="lab">{e(t(l, 'time_label'))}</span>{pills('time_pref', ['time_morning', 'time_afternoon', 'time_evening'])}</div>
   </div>
   <p class="err" id="e-slot" role="alert"></p>
  </div>

  <div class="step" id="s4"><div class="step-h"><span class="medal">04</span><div><h2>{e(t(l, 'step_contact'))}</h2><p>{e(t(l, 'contact_step_sub'))}</p></div></div>
   <div class="field"><label for="f-name">{e(t(l, 'name_label'))} *</label><input id="f-name" name="name" autocomplete="name" required maxlength="120"><p class="err" id="e-name" role="alert"></p></div>
   <div class="two">
    <div class="field"><label for="f-phone">{e(t(l, 'phone_label'))}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="40"></div>
    <div class="field"><label for="f-email">{e(t(l, 'email_label'))}</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="160"></div>
   </div>
   <p class="err" id="e-contact" role="alert"></p>
   <div class="grp"><span class="lab">{e(t(l, 'contact_pref'))}</span><div class="pills"><label><input type="radio" name="contact_pref" value="{e(t(l, 'by_phone'))}" checked><span>{e(t(l, 'by_phone'))}</span></label><label><input type="radio" name="contact_pref" value="{e(t(l, 'by_email'))}"><span>{e(t(l, 'by_email'))}</span></label></div></div>
   <div class="field"><label for="f-notes">{e(t(l, 'notes_label'))}</label><textarea id="f-notes" name="notes" maxlength="1500"></textarea></div>
   <label class="check"><input type="checkbox" name="consent" value="yes" id="f-consent"><span>{e(t(l, 'consent'))}</span></label>
   <p class="err" id="e-consent" role="alert"></p>
  </div>
 </form>
 <div class="result" id="done" hidden tabindex="-1"><span class="k" id="done-k">{e(t(l, 'status_request'))}</span><h2 id="done-h">{e(t(l, 'done_title'))}</h2><p id="done-p">{e(t(l, 'done_text'))}</p><div class="row"><a class="btn ghost" href="{url('home', l)}">{e(t(l, 'nav_home'))}</a></div></div>
 <div class="result" id="fail" hidden tabindex="-1"><h2>{e(t(l, 'fail_title'))}</h2><p>{e(t(l, 'fail_text'))}</p><div class="row"><a class="btn" id="mailto" href="mailto:{B['email']}">{MAIL} {e(t(l, 'send_by_email'))}</a><a class="btn ghost" href="tel:{B['phone_href']}">{e(B['phone'])}</a></div></div>
 </div>
 <aside class="summary esp" aria-live="polite">
  <h2>{e(t(l, 'summary'))}</h2><span class="en">{e(t(l, 'summary_alt'))}</span><span class="fleuron"></span>
  <span class="status" id="sum-status">{e(t(l, 'status_request'))}</span>
  <dl id="sum">{sumrows}</dl>
  <div class="money"><div>{TAG}<span><b id="sum-price">{e(t(l, 'price_pending'))}</b><small>{e(t(l, 'price_pending_alt'))}</small></span></div><div>{HOUR}<span><b id="sum-dur">{e(t(l, 'duration_pending'))}</b><small>{e(t(l, 'duration_pending_alt'))}</small></span></div></div>
  <div class="actions">
   <button class="btn" type="submit" form="bk" id="send">{CAL} {e(t(l, 'send'))} {ARR}</button>
   {f'<a class="btn ghost" id="wa" href="{wa}" rel="noopener">WhatsApp</a>' if wa else ''}
   <a class="btn ghost" id="by-mail" href="mailto:{B['email']}">{MAIL} {e(t(l, 'by_email_btn'))}</a>
  </div>
  <p class="direct">{e(t(l, 'or_contact'))} <a href="tel:{B['phone_href']}">{e(B['phone'])}</a></p>
 </aside>
</div></section>
<div class="mobile-bar" id="mbar"><span id="mbar-t">{e(t(l, 'mobile_choose'))}</span><button class="btn" type="button" id="mbar-b">{e(t(l, 'continue'))}</button></div>
<script id="bk-cfg" type="application/json">{cfg_json}</script>
"""


PAGES = {"home": page_home, "atelier": page_atelier, "services": page_services,
         "gallery": page_gallery, "booking": page_booking, "journal": page_journal}
META = {"home": ("meta_home", "meta_home_desc"), "atelier": ("meta_atelier", None), "services": ("meta_services", None),
        "gallery": ("meta_gallery", None), "booking": ("meta_booking", None), "journal": ("meta_journal", None)}


def write(path, content):
    full = os.path.join(DIST, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)


def build():
    if os.path.exists(DIST):
        shutil.rmtree(DIST)
    shutil.copytree(os.path.join(ROOT, "static"), DIST)
    shutil.copytree(os.path.join(ROOT, "assets"), os.path.join(DIST, "assets"), dirs_exist_ok=True)
    for d in ("admin", "gestion"):
        if os.path.isdir(os.path.join(ROOT, d)):
            shutil.copytree(os.path.join(ROOT, d), os.path.join(DIST, d))
    urls = []
    for l in LANGS:
        for p, fn in PAGES.items():
            tk, dk = META[p]
            title = T[l][tk]
            desc = T[l][dk] if dk else re.sub("<[^>]+>", " ", T[l]["meta_home_desc"])
            body = fn(l)
            write(url(p, l).strip("/") + "/index.html", head(p, l, title, desc) + header(p, l) + body + footer(p, l))
            urls.append((p, l))
        # 404 per language
        nf = f'<section class="final marble" style="min-height:60vh"><div class="wrap"><span class="k both">404</span><h1 class="h" style="margin-top:16px">{e(T[l]["notfound"])}</h1><p style="margin-top:26px"><a class="btn" href="{url("home", l)}">{e(T[l]["nav_home"])} {ARR}</a></p></div></section>'
        write(f"{l}/404.html", head("home", l, "404 — " + B["name"], T[l]["meta_home_desc"]).replace("<head>", '<head>\n<meta name="robots" content="noindex">') + header("", l) + nf + footer("home", l))
    shutil.copy(os.path.join(DIST, "fr/404.html"), os.path.join(DIST, "404.html"))
    # root: language chooser (Netlify redirects handle it server-side; this is the fallback)
    write("index.html", f"""<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{e(B['name'])}</title><link rel="canonical" href="{BASE}/fr/">
<link rel="alternate" hreflang="fr-CA" href="{BASE}/fr/"><link rel="alternate" hreflang="en-CA" href="{BASE}/en/"><link rel="alternate" hreflang="x-default" href="{BASE}/fr/">
<script>(function(){{var m=document.cookie.match(/(?:^|; )nf_lang=(fr|en)/);var l=m?m[1]:((navigator.language||'fr').toLowerCase().indexOf('en')===0?'en':'fr');location.replace('/'+l+'/');}})();</script>
<meta http-equiv="refresh" content="2;url=/fr/"></head><body style="font-family:sans-serif;background:#F7F1E8;color:#2A1A12;text-align:center;padding:60px 20px">
<p><a href="/fr/">Français</a> · <a href="/en/">English</a></p></body></html>""")
    today = date.today().isoformat()
    sm = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">']
    for p, l in urls:
        sm.append(f'<url><loc>{BASE + url(p, l)}</loc><lastmod>{today}</lastmod>'
                  f'<xhtml:link rel="alternate" hreflang="fr-CA" href="{BASE + url(p, "fr")}"/>'
                  f'<xhtml:link rel="alternate" hreflang="en-CA" href="{BASE + url(p, "en")}"/></url>')
    sm.append("</urlset>")
    write("sitemap.xml", "\n".join(sm))
    write("robots.txt", ("User-agent: *\nDisallow: /\n" if INSP else f"User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /gestion/\nSitemap: {BASE}/sitemap.xml\n"))
    write("manifest.webmanifest", json.dumps({"name": B["name"], "short_name": "Dior Braid", "start_url": "/fr/", "display": "standalone",
          "background_color": "#F7F1E8", "theme_color": "#2A1A12",
          "icons": [{"src": "/assets/brand/icon-512.png", "sizes": "512x512", "type": "image/png"}]}))
    # language redirects (server-side, keeps SEO URLs clean)
    rd = ["/api/availability  /.netlify/functions/availability  200", "/api/request  /.netlify/functions/request  200", "/api/owner  /.netlify/functions/owner  200",
          "/gestion  /gestion/  301", "/  /en/  302!  Language=en", "/  /fr/  302!", "/fr/*  /fr/404.html  404", "/en/*  /en/404.html  404"]
    write("_redirects", "\n".join(rd) + "\n")
    print(f"built {len(urls)} pages into dist/")


if __name__ == "__main__":
    build()
