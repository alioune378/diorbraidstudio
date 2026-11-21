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


ARR = '<span class="arr" aria-hidden="true"></span>'
GO = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h11M9 4l4 4-4 4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>'


def placeholder(l, label=None):
    return (f'<div class="ph" role="img" aria-label="{e(T[l]["placeholder_note"])}">'
            f'<img src="/assets/brand/mark.webp" alt="" width="120" height="120" loading="lazy">'
            f'<span>{e(label or T[l]["placeholder_note"])}</span></div>')


# ---------------------------------------------------------------- layout
def head(page, l, title, desc):
    alt = "en" if l == "fr" else "fr"
    canon = BASE + url(page, l)
    ld = {
        "@context": "https://schema.org", "@type": "BeautySalon", "name": B["name"],
        "url": BASE + url("home", l), "telephone": B["phone_href"], "email": B["email"],
        "image": BASE + "/assets/brand/og.jpg", "logo": BASE + "/assets/brand/logo-full.png",
        "address": {"@type": "PostalAddress", "addressLocality": "Laval", "addressRegion": "QC", "addressCountry": "CA"},
        "areaServed": "Laval, Montréal", "priceRange": "$$",
        "sameAs": [s["url"] for s in socials()],
    }
    return f"""<!doctype html>
<html lang="{l}-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">
<link rel="canonical" href="{canon}">
<link rel="alternate" hreflang="fr-CA" href="{BASE + url(page, 'fr')}">
<link rel="alternate" hreflang="en-CA" href="{BASE + url(page, 'en')}">
<link rel="alternate" hreflang="x-default" href="{BASE + url(page, 'fr')}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="{e(B['name'])}">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{canon}">
<meta property="og:image" content="{BASE}/assets/brand/og.jpg">
<meta property="og:locale" content="{'fr_CA' if l == 'fr' else 'en_CA'}">
<meta property="og:locale:alternate" content="{'en_CA' if l == 'fr' else 'fr_CA'}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#2A1A12">
<link rel="icon" href="/assets/brand/favicon-64.png" type="image/png">
<link rel="apple-touch-icon" href="/assets/brand/apple-touch-icon.png">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v={V}">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
"""


def header(page, l):
    t = T[l]
    alt = "en" if l == "fr" else "fr"
    links = "".join(
        f'<a href="{url(p, l)}"{" aria-current=page" if p == page else ""}>{e(t["nav_" + p])}</a>' for p in NAV)
    dlinks = "".join(
        f'<a href="{url(p, l)}"{" aria-current=page" if p == page else ""}>{e(t["nav_" + p])}</a>' for p in NAV + ["booking"])
    sw = f'<a class="lang" href="{url(page or "home", alt)}" hreflang="{alt}" lang="{alt}" data-lang="{alt}" aria-label="{e(t["lang_switch"])}">{alt.upper()}</a>'
    wa = whatsapp()
    return f"""<body data-page="{page}" data-lang="{l}">
<a class="skip" href="#main">{e(t['skip'])}</a>
<header class="hdr" id="hdr">
 <div class="wrap hdr-in">
  <a class="brand" href="{url('home', l)}" aria-label="{e(B['name'])} — {e(t['nav_home'])}">
   <picture><source srcset="/assets/brand/logo-nav.webp" type="image/webp"><img src="/assets/brand/logo-nav.png" alt="{e(B['name'])}" width="520" height="461"></picture>
  </a>
  <nav class="nav" aria-label="Navigation">{links}</nav>
  <div class="hdr-r">
   {sw}
   <a class="btn" href="{url('booking', l)}">{e(t['cta_book_short'])}</a>
   <button class="burger" type="button" aria-controls="drawer" aria-expanded="false" aria-label="{e(t['menu'])}"><span></span></button>
  </div>
 </div>
</header>
<div class="drawer" id="drawer" role="dialog" aria-modal="true" aria-label="{e(t['menu'])}" hidden>
 <div class="drawer-top">
  <picture><source srcset="/assets/brand/logo-nav-white.webp" type="image/webp"><img src="/assets/brand/logo-nav-white.png" alt="{e(B['name'])}" width="520" height="461"></picture>
  <button class="x" type="button" aria-label="{e(t['close'])}">&times;</button>
 </div>
 <nav aria-label="Menu">{dlinks}</nav>
 <div class="foot">
  <a class="btn gold" href="{url('booking', l)}">{e(t['cta_book'])} {ARR}</a>
  <a href="tel:{B['phone_href']}">{e(B['phone'])}</a>
  <a href="mailto:{B['email']}">{e(B['email'])}</a>
  {f'<a href="{wa}" rel="noopener">WhatsApp</a>' if wa else ''}
  <span>{e(location_text(l))} · {e(hours_text(l))}</span>
  {sw}
 </div>
</div>
<main id="main">
"""


def footer(page, l):
    t = T[l]
    alt = "en" if l == "fr" else "fr"
    wa = whatsapp()
    soc = "".join(f'<a href="{e(s["url"])}" rel="noopener">{e(s["network"])}</a>' for s in socials())
    nav = "".join(f'<a href="{url(p, l)}">{e(t["nav_" + p])}</a>' for p in NAV + ["booking"])
    cr = S["credit"]
    return f"""</main>
<footer class="foot-s">
 <div class="wrap">
  <div class="foot-grid">
   <div>
    <picture><source srcset="/assets/brand/logo-full-white.webp" type="image/webp"><img class="logo" src="/assets/brand/logo-full-white.png" alt="{e(B['name'])} — Luxury Braiding Experience" width="900" height="888" loading="lazy"></picture>
   </div>
   <div>
    <h4>{e(t['contact_title'])}</h4>
    <p><a href="tel:{B['phone_href']}">{e(B['phone'])}</a></p>
    <p><a href="mailto:{B['email']}">{e(B['email'])}</a></p>
    {f'<p><a href="{wa}" rel="noopener">WhatsApp</a></p>' if wa else ''}
    {f'<p>{soc}</p>' if soc else ''}
    <h4 style="margin-top:28px">{e(t['location_label'])}</h4>
    <p>{e(location_text(l))}</p>
    <p>{e(t['footer_note'])}</p>
   </div>
   <div>
    <h4>{e(t['hours_label'])}</h4>
    <p>{e(hours_text(l))}</p>
    <h4 style="margin-top:28px">Navigation</h4>
    <nav aria-label="Footer">{nav}</nav>
   </div>
  </div>
  <div class="foot-b">
   <span>© {date.today().year} {e(B['name'])}</span>
   <span>{e(t['credit'])} <a href="{e(cr['url'])}" rel="noopener">{e(cr['name'])}</a></span>
   <a class="lang" href="{url(page, alt)}" hreflang="{alt}" lang="{alt}" data-lang="{alt}">{e(t['lang_switch'])}</a>
  </div>
 </div>
</footer>
<script src="/assets/js/site.js?v={V}" defer></script>
</body>
</html>
"""


# ---------------------------------------------------------------- pages
def page_home(l):
    t, h = T[l], S["home"]
    svcs = "".join(
        f'<li class="rv"><a href="{url("services", l)}#{s["id"]}"><span class="rn">{ROMAN[i]}</span>'
        f'<span class="nm">{e(tr(s["name"], l))}</span><span class="pr">{e(svc_price(s, l))}</span>'
        f'<span class="go">{GO}</span></a></li>' for i, s in enumerate(svc_list()))
    sig = S["signature"]
    pillars = "".join(
        f'<div class="pillar rv"><h3>{e(tr(p, l))}</h3><p>{e(tr(p["text"], l))}</p></div>' for p in sig["pillars"])
    gal = [g for g in S["gallery"]["items"] if g.get("status", "READY") == "READY" and g.get("image")][:3]
    if gal:
        arches = "".join(
            f'<figure class="ph" style="padding:0"><img src="{e(g["image"])}" alt="{e(tr(g.get("alt") or g.get("caption"), l))}" loading="lazy" style="width:100%;height:100%;object-fit:cover;opacity:1;max-width:none"></figure>' for g in gal)
    else:
        arches = "".join(placeholder(l, t["lookbook_soon"]) for _ in range(3))
    topics = "".join(
        f'<li class="rv"><h3>{e(tr(x, l))}</h3><span class="tag">{e(t["journal_draft"])}</span></li>' for x in S["journal"]["topics"][:3])
    return f"""
<section class="hero veins">
 <div class="wrap hero-grid">
  <div class="rv">
   <span class="kicker">{e(t['private_studio'])} · Laval</span>
   <h1 class="display">{h['hero_title'][l]}</h1>
   <div class="meta"><span>{e(t['heritage_kicker'])}</span><span>{h['years']}+ {e(t['years_label'])}</span><span>{e(t['by_appointment'])}</span></div>
   <p class="lede">{e(tr(h['hero_text'], l))}</p>
   <div class="hero-actions" style="margin-top:34px">
    <a class="btn" href="{url('booking', l)}">{e(t['cta_book'])} {ARR}</a>
    <a class="link" href="{url('services', l)}">{e(t['home_cta_services'])}</a>
   </div>
  </div>
  <div class="arch draw rv">
   <div class="frame"><picture><source media="(max-width:720px)" srcset="/assets/studio/studio-m.webp"><img src="/assets/studio/studio-l.webp" alt="{e(t['studio_kicker'])} — {e(B['name'])}, Laval" width="1086" height="1448" fetchpriority="high"></picture></div>
   <span class="ring" aria-hidden="true"></span>
   <span class="cap">{e(t['private_studio'])}<b>Laval</b></span>
  </div>
 </div>
</section>

<section class="years on-dark">
 <div class="wrap years-grid">
  <div class="rv"><div class="big-num" aria-hidden="true">{h['years']}<sup>+</sup></div><div class="lab">{e(t['years_label'])}</div></div>
  <div class="rv">
   <span class="kicker">{e(t['heritage_kicker'])}</span>
   <h2 class="display" style="margin-top:22px">{t['heritage_title']}</h2>
   <p class="lede" style="margin-top:26px">{e(tr(S['founder']['bio'], l))}</p>
   <p style="margin-top:30px"><a class="link" style="color:var(--gold-lt)" href="{url('atelier', l)}">{e(t['discover_atelier'])}</a></p>
  </div>
 </div>
</section>

<section class="svc">
 <div class="wrap">
  <div class="svc-head">
   <div class="rv"><span class="kicker">{e(t['services_kicker'])}</span><h2 class="display" style="margin-top:22px">{t['services_title']}</h2></div>
   <p class="lede rv">{e(t['services_intro'])}</p>
  </div>
  <ul class="svc-list">{svcs}</ul>
 </div>
</section>

<section class="sig on-dark" aria-labelledby="sig-t">
 <img class="mark" src="/assets/brand/mark.webp" alt="" width="600" height="600" loading="lazy">
 <div class="wrap">
  <span class="kicker rv">{e(tr(sig['title'], l))}</span>
  <h2 class="sr" id="sig-t">{e(tr(sig['title'], l))}</h2>
  <blockquote class="rv">{e(tr(sig['quote'], l))}</blockquote>
  <div class="pillars">{pillars}</div>
 </div>
</section>

<section class="look">
 <div class="wrap look-grid">
  <div class="rv">
   <span class="kicker">{e(t['lookbook_kicker'])}</span>
   <h2 class="display" style="margin-top:22px">{t['lookbook_title']}</h2>
   <p class="lede" style="margin-top:24px">{e(t['lookbook_text'])}</p>
   <p style="margin-top:30px"><a class="link" href="{url('gallery', l)}">{e(t['see_gallery'])}</a></p>
  </div>
  <div class="look-arches rv">{arches}</div>
 </div>
</section>

<section class="atel">
 <div class="wrap atel-grid">
  <div class="atel-photo rv"><div class="frame"><img src="/assets/studio/studio-m.webp" alt="{e(t['studio_kicker'])} — {e(B['name'])}" width="720" height="960" loading="lazy"></div></div>
  <div class="rv">
   <span class="kicker">{e(t['atelier_kicker'])}</span>
   <h2 class="display" style="margin-top:22px">{t['atelier_title']}</h2>
   <p class="lede" style="margin-top:24px">{e(t['atelier_text'])}</p>
   <p style="margin-top:30px"><a class="link" href="{url('atelier', l)}">{e(t['discover_atelier'])}</a></p>
  </div>
 </div>
</section>

<section class="journal" style="padding-top:0">
 <div class="wrap">
  <span class="kicker rv">{e(t['journal_kicker'])}</span>
  <h2 class="display rv" style="margin-top:22px">{t['journal_title']}</h2>
  <ul class="topics">{topics}</ul>
  <p style="margin-top:30px"><a class="link" href="{url('journal', l)}">{e(t['nav_journal'])}</a></p>
 </div>
</section>
""" + final_cta(l)


def final_cta(l):
    t = T[l]
    return f"""
<section class="final on-dark">
 <div class="wrap rv">
  <span class="kicker">{e(t['by_appointment'])}</span>
  <h2 class="display" style="margin-top:22px">{t['final_title']}</h2>
  <p class="lede">{e(t['final_text'])}</p>
  <a class="btn gold" href="{url('booking', l)}">{e(t['cta_book'])} {ARR}</a>
 </div>
</section>
"""


def page_atelier(l):
    t, f = T[l], S["founder"]
    portrait = f.get("portrait", {})
    if ready(portrait) and portrait.get("src"):
        pic = f'<div class="arch"><div class="frame"><img src="{e(portrait["src"])}" alt="Dior" loading="lazy"></div></div>'
    else:
        pic = f'<div class="arch draw rv"><div class="frame"><img src="/assets/studio/studio-l.webp" alt="{e(t["studio_kicker"])} — {e(B["name"])}" width="1086" height="1448"></div><span class="ring" aria-hidden="true"></span><span class="cap">{e(t["private_studio"])}<b>Laval</b></span></div>'
    return f"""
<section class="phead veins"><div class="wrap rv">
 <span class="kicker">{e(t['atelier_kicker'])}</span>
 <h1 class="display" style="margin-top:22px">{t['atelier_page_title']}</h1>
</div></section>
<section class="atp"><div class="wrap atp-grid">
 {pic}
 <div class="atp-text rv">
  <span class="kicker">{e(t['founder_kicker'])}</span>
  <p>{e(tr(f['bio'], l))}</p>
  <div class="facts" style="margin-top:40px">
   <div><dt>{e(t['heritage_kicker'])}</dt><dd>{S['home']['years']}+ {e(t['years_label'])}</dd></div>
   <div><dt>{e(t['location_label'])}</dt><dd>{e(location_text(l))}</dd></div>
   <div><dt>{e(t['hours_label'])}</dt><dd>{e(hours_text(l))}</dd></div>
   <div><dt>{e(t['private_studio'])}</dt><dd>1:1</dd></div>
  </div>
  <span class="kicker" style="margin-top:40px">{e(t['studio_kicker'])}</span>
  <p class="small">{e(t['atelier_text'])}</p>
  <p class="small">{e(t['studio_text'])}</p>
 </div>
</div></section>
<section class="sig on-dark"><img class="mark" src="/assets/brand/mark.webp" alt="" width="600" height="600" loading="lazy"><div class="wrap">
 <span class="kicker rv">{e(tr(S['signature']['title'], l))}</span>
 <blockquote class="rv">{e(tr(S['signature']['quote'], l))}</blockquote>
 <div class="pillars">{''.join(f'<div class="pillar rv"><h3>{e(tr(p, l))}</h3><p>{e(tr(p["text"], l))}</p></div>' for p in S['signature']['pillars'])}</div>
</div></section>
""" + final_cta(l)


def page_services(l):
    t = T[l]
    items = []
    for i, s in enumerate(svc_list()):
        img = f'<div class="arch"><div class="frame"><img src="{e(s["image"])}" alt="{e(tr(s["name"], l))}" loading="lazy"></div></div>' if s.get("image") else placeholder(l)
        vars_ = [v for v in s.get("variations", []) if v.get("status", "READY") == "READY"]
        if vars_:
            vhtml = "<ul class='topics' style='margin:0 0 24px'>" + "".join(
                f'<li><h3 style="font-size:24px">{e(tr(v["name"], l))}</h3><span class="tag">{e(money(v.get("price_cad"), l) or t["price_pending"])}'
                f'{(" · " + e(dur(v.get("duration_min"), l))) if v.get("duration_min") else ""}</span></li>' for v in vars_) + "</ul>"
        else:
            vhtml = f'<p class="note">{e(t["variations_pending"])}</p>'
        adds = [a for a in s.get("addons", []) if a.get("status", "READY") == "READY"]
        ahtml = (f'<p class="note"><strong>{e(t["addons_label"])} :</strong> ' if l == "fr" else f'<p class="note"><strong>{e(t["addons_label"])}:</strong> ') + \
            ", ".join(f'{e(tr(a["name"], l))}{(" (+" + money(a["price_cad"], l) + ")") if a.get("price_cad") not in (None, "") else ""}' for a in adds) + "</p>" if adds else ""
        prep = s.get("preparation", {})
        prep_txt = tr(prep, l) if ready(prep) and tr(prep, l) else t["prep_pending"]
        incomplete = s.get("price_cad") in (None, "") and not vars_
        cta = (f'<a class="btn" href="{url("booking", l)}?service={s["id"]}">{e(t["consult_cta"] if incomplete else t["cta_book"])} {ARR}</a>')
        items.append(f"""
<article class="svc-item" id="{s['id']}">
 <div class="svc-media rv">{img}</div>
 <div class="svc-body rv">
  <span class="rn">{ROMAN[i]}</span>
  <h2>{e(tr(s['name'], l))}</h2>
  <p>{e(tr(s['description'], l))}</p>
  <dl class="facts">
   <div><dt>{e(t['price_label'])}</dt><dd>{e(svc_price(s, l))}</dd></div>
   <div><dt>{e(t['duration_label'])}</dt><dd>{e(svc_dur(s, l))}</dd></div>
  </dl>
  {vhtml}{ahtml}
  <p class="note"><strong>{e(t['prep_label'])} —</strong> {e(prep_txt)}</p>
  {f'<p class="note">{e(t["consult_text"])}</p>' if incomplete else ''}
  {cta}
 </div>
</article>""")
    pol = policies(l)
    return f"""
<section class="phead veins"><div class="wrap rv">
 <span class="kicker">{e(t['services_kicker'])}</span>
 <h1 class="display" style="margin-top:22px">{t['services_page_title']}</h1>
 <p class="lede">{e(t['services_page_intro'])}</p>
</div></section>
<section class="svc-full"><div class="wrap">{''.join(items)}{pol}</div></section>
""" + final_cta(l)


def policies(l):
    t = T[l]
    dep, can = BK.get("deposit", {}), BK.get("cancellation_policy", {})
    rows = ""
    if ready(dep) and tr(dep.get("text"), l):
        rows += f'<div><dt>{e(t["deposit_label"])}</dt><dd style="font-size:19px">{e(tr(dep["text"], l))}</dd></div>'
    if ready(can) and tr(can.get("text"), l):
        rows += f'<div><dt>{e(t["cancel_label"])}</dt><dd style="font-size:19px">{e(tr(can["text"], l))}</dd></div>'
    if not rows:
        return ""  # never invent policies
    return f'<div class="svc-item" style="display:block"><span class="kicker">{e(t["policies_title"])}</span><dl class="facts">{rows}</dl></div>'


def page_gallery(l):
    t = T[l]
    cats = S["gallery"]["categories"]
    names = {s["id"]: tr(s["name"], l) for s in S["services"]}
    btns = f'<button type="button" aria-pressed="true" data-f="all">{e(t["filter_all"])}</button>' + "".join(
        f'<button type="button" aria-pressed="false" data-f="{c}">{e(names.get(c, c))}</button>' for c in cats)
    items = [g for g in S["gallery"]["items"] if g.get("status", "READY") == "READY" and g.get("image")]
    figs = []
    for g in items:
        cap = tr(g.get("caption"), l)
        figs.append(f'<figure class="g-item" data-c="{e(g.get("category", ""))}"><img class="photo" src="{e(g["image"])}" alt="{e(tr(g.get("alt"), l) or cap or names.get(g.get("category"), ""))}" loading="lazy">'
                    f'{f"<figcaption>{e(cap)}</figcaption>" if cap else ""}</figure>')
    present = {g.get("category") for g in items}
    for c in cats:  # labelled placeholders for categories with no real photo yet
        if c not in present:
            for _ in range(2):
                figs.append(f'<figure class="g-item" data-c="{c}" data-ph="1">{placeholder(l)}<figcaption>{e(names.get(c, c))}</figcaption></figure>')
    note = "" if items else f'<p class="notice">{e(t["gallery_intro"])}</p>'
    return f"""
<section class="phead veins"><div class="wrap rv">
 <span class="kicker">{e(t['lookbook_kicker'])}</span>
 <h1 class="display" style="margin-top:22px">{t['gallery_title']}</h1>
</div></section>
<section><div class="wrap">
 {note}
 <div class="filters" role="toolbar" aria-label="Filtres">{btns}</div>
 <div class="g-grid" id="gallery">{''.join(figs)}</div>
</div></section>
""" + final_cta(l)


def page_journal(l):
    t = T[l]
    arts = [a for a in S["journal"].get("articles", []) if a.get("status") == "READY"]
    body = ""
    for a in arts:
        body += f'<article class="svc-item" style="display:block"><h2 class="display" style="font-size:clamp(34px,4vw,56px)">{e(tr(a["title"], l))}</h2><div class="lede" style="max-width:720px">{tr(a.get("body"), l)}</div></article>'
    topics = "".join(f'<li class="rv"><h3>{e(tr(x, l))}</h3><span class="tag">{e(t["journal_draft"])}</span></li>' for x in S["journal"]["topics"])
    return f"""
<section class="phead veins"><div class="wrap rv">
 <span class="kicker">{e(t['journal_kicker'])}</span>
 <h1 class="display" style="margin-top:22px">{t['journal_title']}</h1>
 <p class="lede">{e(t['journal_page_intro'])}</p>
</div></section>
<section class="journal" style="padding-top:0"><div class="wrap">
 {body}
 {'' if arts else f'<p class="notice">{e(t["journal_soon"])}</p>'}
 <ul class="topics">{topics}</ul>
</div></section>
""" + final_cta(l)


def page_booking(l):
    t = T[l]
    sched = BK.get("mode") == "scheduler" and BK.get("scheduler_url")
    data = []
    for s in svc_list():
        data.append({
            "id": s["id"], "name": tr(s["name"], l), "price": s.get("price_cad"), "dur": s.get("duration_min"),
            "sizes": s.get("sizes", True), "lengths": s.get("lengths", True),
            "variations": [{"name": tr(v["name"], l), "price": v.get("price_cad"), "dur": v.get("duration_min")} for v in s.get("variations", []) if v.get("status", "READY") == "READY"],
            "addons": [{"name": tr(a["name"], l), "price": a.get("price_cad")} for a in s.get("addons", []) if a.get("status", "READY") == "READY"],
        })
    svc_choices = "".join(
        f'<label class="choice"><input type="radio" name="service" value="{e(s["name"])}" data-id="{s["id"]}" required><span><b>{e(s["name"])}</b><small>{e(svc_price(next(x for x in S["services"] if x["id"] == s["id"]), l))}</small></span></label>'
        for s in data)

    def pills(name, opts):
        return '<div class="pills">' + "".join(
            f'<label class="choice"><input type="radio" name="{name}" value="{e(t[o])}"><span>{e(t[o])}</span></label>' for o in opts) + "</div>"
    lengths = pills("length", ["len_short", "len_medium", "len_long", "len_xlong"])
    sizes = pills("size", ["size_small", "size_medium", "size_large"])
    times = pills("time", ["time_morning", "time_afternoon", "time_evening"])
    today = date.today().isoformat()
    cfg = {"lang": l, "services": data, "t": {k: t[k] for k in [
        "price_pending", "duration_pending", "from", "summary_empty", "variation_none", "addons_none", "not_applicable",
        "err_service", "err_name", "err_contact", "err_consent", "err_photo", "sending", "send", "photo_yes", "photo_none",
        "summary_service", "summary_variation", "summary_style", "summary_length", "summary_size", "summary_addons",
        "summary_date", "summary_photo", "name_label", "phone_label", "email_label", "notes_label", "status_request", "time_label"]},
        "email": B["email"], "subject": ("Demande de rendez-vous" if l == "fr" else "Appointment request")}
    sched_block = ""
    if sched:
        sched_block = f"""<div class="result" style="margin-bottom:34px">
  <h2 style="font-size:clamp(30px,3vw,42px)">{e(t['scheduler_cta'])}</h2>
  <p>{e(t['scheduler_note'])}</p>
  <div class="row"><a class="btn" href="{e(BK['scheduler_url'])}" target="_blank" rel="noopener" data-scheduler>{e(t['scheduler_cta'])} {ARR}</a></div>
 </div>"""
    wa = whatsapp()
    cfg_json = json.dumps(cfg, ensure_ascii=False).replace("</", "<" + chr(92) + "/")
    return f"""
<section class="phead veins"><div class="wrap rv">
 <span class="kicker">{e(t['by_appointment'])}</span>
 <h1 class="display" style="margin-top:22px">{t['booking_title']}</h1>
 <p class="lede">{e(t['booking_intro_scheduler'] if sched else t['booking_intro'])}</p>
</div></section>
<section class="bk"><div class="wrap bk-grid">
 <div>
 {sched_block}
 <form id="bk" name="rendez-vous" method="POST" action="{url('booking', l)}?sent=1" data-netlify="true" netlify-honeypot="company" enctype="multipart/form-data" novalidate>
  <input type="hidden" name="form-name" value="rendez-vous">
  <input type="hidden" name="language" value="{l}">
  <input type="hidden" name="summary" value="">
  <input type="hidden" name="status" value="{e(T['fr']['status_request'])}">
  <p class="sr"><label>Company <input name="company" tabindex="-1" autocomplete="off"></label></p>
  <ol class="bk-steps">
   <li class="bk-step open" data-step="1">
    <button type="button" class="head" aria-expanded="true"><span class="num">01</span><span class="ttl">{e(t['step_service'])}</span><span class="val" data-v="1"></span></button>
    <div class="body">
     <fieldset style="border:0;margin:0;padding:0"><legend class="sr">{e(t['choose_service'])}</legend>
      <div class="choices" id="svc-choices">{svc_choices}</div></fieldset>
     <div class="field" id="var-wrap" style="margin-top:22px" hidden><span class="lab">{e(t['variation_label'])}</span><div class="choices" id="var-choices"></div></div>
     <p class="err" id="e-service" role="alert"></p>
     <div class="step-nav"><button type="button" class="btn" data-next>{e(t['next'])} {ARR}</button></div>
    </div>
   </li>
   <li class="bk-step" data-step="2">
    <button type="button" class="head" aria-expanded="false"><span class="num">02</span><span class="ttl">{e(t['step_style'])}</span><span class="val" data-v="2"></span></button>
    <div class="body">
     <div class="field"><label for="f-style">{e(t['style_label'])}</label><textarea id="f-style" name="style" maxlength="800" placeholder="{e(t['style_ph'])}"></textarea></div>
     <div class="field"><label for="f-photo">{e(t['photo_label'])}</label><input id="f-photo" type="file" name="inspiration" accept="image/jpeg,image/png,image/webp,image/heic"><p class="hint">{e(t['photo_help'])}</p><p class="err" id="e-photo" role="alert"></p></div>
     <div class="step-nav"><button type="button" class="btn line" data-back>{e(t['back'])}</button><button type="button" class="btn" data-next>{e(t['next'])} {ARR}</button></div>
    </div>
   </li>
   <li class="bk-step" data-step="3">
    <button type="button" class="head" aria-expanded="false"><span class="num">03</span><span class="ttl">{e(t['step_details'])}</span><span class="val" data-v="3"></span></button>
    <div class="body">
     <div class="field" id="len-wrap"><span class="lab">{e(t['length_label'])}</span>{lengths}</div>
     <div class="field" id="size-wrap"><span class="lab">{e(t['size_label'])}</span>{sizes}</div>
     <div class="field"><span class="lab">{e(t['addons_label'])}</span><div id="addon-choices" class="pills"></div><p class="hint" id="addon-none">{e(t['addons_none'])}</p></div>
     <p class="hint">{e(t['pref_note'])}</p>
     <div class="step-nav"><button type="button" class="btn line" data-back>{e(t['back'])}</button><button type="button" class="btn" data-next>{e(t['next'])} {ARR}</button></div>
    </div>
   </li>
   <li class="bk-step" data-step="4">
    <button type="button" class="head" aria-expanded="false"><span class="num">04</span><span class="ttl">{e(t['step_date'])}</span><span class="val" data-v="4"></span></button>
    <div class="body">
     <div class="field"><label for="f-date">{e(t['date_label'])}</label><input id="f-date" type="date" name="date" min="{today}"></div>
     <div class="field"><span class="lab">{e(t['time_label'])}</span>{times}</div>
     <p class="hint">{e(t['date_note'])}</p>
     <div class="step-nav"><button type="button" class="btn line" data-back>{e(t['back'])}</button><button type="button" class="btn" data-next>{e(t['next'])} {ARR}</button></div>
    </div>
   </li>
   <li class="bk-step" data-step="5">
    <button type="button" class="head" aria-expanded="false"><span class="num">05</span><span class="ttl">{e(t['step_contact'])}</span><span class="val" data-v="5"></span></button>
    <div class="body">
     <div class="field"><label for="f-name">{e(t['name_label'])} <span aria-hidden="true">*</span></label><input id="f-name" name="name" autocomplete="name" required maxlength="120"><p class="err" id="e-name" role="alert"></p></div>
     <div class="two">
      <div class="field"><label for="f-phone">{e(t['phone_label'])}</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" inputmode="tel" maxlength="40"></div>
      <div class="field"><label for="f-email">{e(t['email_label'])}</label><input id="f-email" name="email" type="email" autocomplete="email" maxlength="160"></div>
     </div>
     <p class="err" id="e-contact" role="alert"></p>
     <div class="field"><span class="lab">{e(t['contact_pref'])}</span><div class="pills">
      <label class="choice"><input type="radio" name="contact_pref" value="{e(t['by_phone'])}" checked><span>{e(t['by_phone'])}</span></label>
      <label class="choice"><input type="radio" name="contact_pref" value="{e(t['by_email'])}"><span>{e(t['by_email'])}</span></label></div></div>
     <div class="field"><label for="f-notes">{e(t['notes_label'])}</label><textarea id="f-notes" name="notes" maxlength="1500"></textarea></div>
     <label class="check"><input type="checkbox" name="consent" value="yes" required id="f-consent"><span>{e(t['consent'])}</span></label>
     <p class="err" id="e-consent" role="alert"></p>
     <p class="hint">{e(t['review_text'])}</p>
     <div class="step-nav"><button type="button" class="btn line" data-back>{e(t['back'])}</button><button type="submit" class="btn" id="send">{e(t['send'])} {ARR}</button></div>
    </div>
   </li>
  </ol>
 </form>
 <div class="result" id="done" hidden tabindex="-1">
  <span class="kicker">{e(t['status_request'])}</span>
  <h2 style="margin-top:14px">{e(t['done_title'])}</h2>
  <p>{e(t['done_text'])}</p>
  <div class="row"><a class="btn line" href="{url('home', l)}">{e(t['nav_home'])}</a></div>
 </div>
 <div class="result" id="fail" hidden tabindex="-1">
  <h2>{e(t['fail_title'])}</h2>
  <p>{e(t['fail_text'])}</p>
  <div class="row"><a class="btn" id="mailto" href="mailto:{B['email']}">{e(t['send_by_email'])} {ARR}</a><a class="btn line" href="tel:{B['phone_href']}">{e(B['phone'])}</a></div>
 </div>
 </div>
 <aside class="summary on-dark" aria-live="polite">
  <h2>{e(t['summary'])}</h2>
  <span class="status">{e(t['status_request'])}</span>
  <dl id="sum"></dl>
  <div class="money" id="money"></div>
  <div class="direct">
   <strong style="color:var(--gold-lt);font-weight:500;letter-spacing:.2em;text-transform:uppercase;font-size:11px">{e(t['or_contact'])}</strong>
   <a href="tel:{B['phone_href']}">{e(B['phone'])}</a>
   <a href="mailto:{B['email']}">{e(B['email'])}</a>
   {f'<a href="{wa}" rel="noopener">WhatsApp</a>' if wa else ''}
   <span>{e(location_text(l))} · {e(hours_text(l))}</span>
  </div>
 </aside>
</div></section>
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
    if os.path.isdir(os.path.join(ROOT, "admin")):
        shutil.copytree(os.path.join(ROOT, "admin"), os.path.join(DIST, "admin"))
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
        nf = f'<section class="phead veins" style="min-height:50vh"><div class="wrap"><span class="kicker">404</span><h1 class="display" style="margin-top:22px">{e(T[l]["notfound"])}</h1><p style="margin-top:30px"><a class="btn" href="{url("home", l)}">{e(T[l]["nav_home"])} {ARR}</a></p></div></section>'
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
    write("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /admin/\nSitemap: {BASE}/sitemap.xml\n")
    write("manifest.webmanifest", json.dumps({"name": B["name"], "short_name": "Dior Braid", "start_url": "/fr/", "display": "standalone",
          "background_color": "#F7F1E8", "theme_color": "#2A1A12",
          "icons": [{"src": "/assets/brand/icon-512.png", "sizes": "512x512", "type": "image/png"}]}))
    # language redirects (server-side, keeps SEO URLs clean)
    rd = ["/  /en/  302!  Language=en", "/  /fr/  302!", "/fr/*  /fr/404.html  404", "/en/*  /en/404.html  404"]
    write("_redirects", "\n".join(rd) + "\n")
    print(f"built {len(urls)} pages into dist/")


if __name__ == "__main__":
    build()
