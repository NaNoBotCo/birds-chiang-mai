#!/usr/bin/env python3
"""build.py — writes docs/index.html (English) and docs/th/index.html (Thai), docs/data.js,
sitemap.xml and llms.txt from tools/birds.json, tools/credits.json and the copy below.

Both languages are written by hand here. Run:  python3 tools/build.py
"""
import html
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, "..", "docs")
BASE = "https://nanobotco.github.io/birds-chiang-mai/"
DATA = json.load(open(os.path.join(HERE, "birds.json")))
CRED_PATH = os.path.join(HERE, "credits.json")
CRED = json.load(open(CRED_PATH)) if os.path.exists(CRED_PATH) else {}
# a file is only credited if it is on disk
for slug, c in list(CRED.items()):
    for k in ("audio", "img"):
        if c.get(k) and not os.path.exists(os.path.join(DOCS, c[k]["file"])):
            c[k] = None

E = html.escape

UI = {
    "en": {
        "title": "Birds of Chiang Mai",
        "kicker": "นกเชียงใหม่ · drawn by arithmetic, heard from real recordings",
        "lede": "The sky over Doi Suthep as it is right now, worked out from the sun and moon. Tap a bird to hear its real call.",
        "slider": "Time of day", "now_btn": "Now", "amb_off": "Let them sing", "amb_on": "Singing on their own · stop",
        "nav": [("sky", "Sky"), ("clock", "Coucal Clock"), ("birds", "Birds"), ("chorus", "Chorus"), ("mountain-sec", "Mountain"), ("legends", "Legends"), ("sources", "Sources")],
        "clock_h": "The Coucal Clock",
        "clock_th": "นาฬิกานกกระปูด",
        "clock_p": [
            "A cuckoo clock whose bird is a greater coucal. It calls at civil dawn and civil dusk, the moments the sun stands 6° below the horizon, worked out fresh each day for San Sai, so the call drifts through the year the way a living coucal's does.",
            "The clock is a pair of carved teak almanac clocks for a wat in San Sai. This is its face, redrawn for the web: Thai numerals, the Buddhist year, the lunar day counted from the published wan phra calendar, and a moon window.",
            "The moon window works like the old German and Swiss dials. One disc carries two moons and turns half a circle each lunation behind two cloud humps. The proportions were fitted against the real moon: the lit area it shows is within 1.1 percentage points of the sky's, and the disc resets at every true new moon.",
        ],
        "next": "Next call", "dawn": "Dawn", "dusk": "Dusk", "in_": "in", "moon": "Moon", "lunar": "Lunar day",
        "call": "Call now", "sound_off": "Call aloud at dawn and dusk", "sound_on": "Calling at dawn and dusk · on",
        "warp_off": "A day in a minute", "warp_on": "A day in a minute · stop",
        "waxing": "waxing", "waning": "waning",
        "year_h": "The call through the year",
        "year_facts": "This year at San Sai the coucal's earliest dawn call is on {ed} at {edt} and its latest on {ld} at {ldt}. Dusk comes earliest on {ek} at {ekt} and latest on {lk} at {lkt}. The earliest dawn and the latest dusk miss the solstice by weeks: the equation of time, the sun running fast or slow against the clock.",
        "birds_h": "The birds",
        "birds_p": "Each bird is drawn from a few dozen numbers: a superellipse body, a teardrop wing, a Bézier neck, spirals and stripes. Press play to hear a real recording; the bird opens its bill as loud as the sound is. The strip at the bottom of the screen is a spectrogram: pitch rises up the strip, brightness is loudness. Each card then counts its own recording, in your browser.",
        "chips": [("all", "All"), ("town", "Town"), ("water", "Water"), ("fields", "Fields"), ("forest", "Forest"), ("mountain", "Mountain"), ("night", "Night")],
        "listen": "Listen for", "fact": "Fact", "lore": "Story", "where": "Places to try", "photo": "Photograph", "play": "Play", "no_rec": "No recording yet",
        "rec": "Recording", "by": "by",
        "chorus_h": "Who sings when",
        "chorus_p": "Each ring is one bird; its thickness is how much it sings at that hour, shaped to today's sunrise and sunset in Chiang Mai. The red dashes are civil dawn and dusk. Drag the hand round the day, then press play to hear that hour. The curves follow field-guide habits; they are a sketch of a typical day.",
        "chorus_play": "Play this hour", "chorus_stop": "Stop the chorus", "quiet": "A quiet hour", "ring_hint": "tap play to hear the hour",
        "at": [("dawn", "Dawn"), ("noon", "Noon"), ("dusk", "Dusk"), ("midnight", "Midnight")],
        "mountain_h": "Up the mountain",
        "mountain_p": "From the moat at about 310 m to the top of Doi Inthanon at 2,565 m. Each column is the height band where you can expect a bird (approximate). Tap a bird to hear it.",
        "legends_h": "Birds of the Himmapan",
        "legends_p": "The Himmapan is the forest at the foot of Mount Meru, home of the mixed creatures painted on temple walls and carved on gables across Lanna.",
        "legends": [
            ("hatsadiling", "Hatsadiling", "นกหัสดีลิงค์", "A bird of the Himmapan with an elephant's head. In Lanna, a high monk or a royal may be cremated on a pyre built as a hatsadiling. In 2008 the pyre for Chan Kusalo, head of the northern sangha, stood at Wat Chedi Luang.", "chedi_luang"),
            ("hamsa", "Hamsa", "หงส์", "The goose of Brahma and the emblem of Hongsawadi, the Mon kingdom at Bago. Mon and Burmese-style temples raise a hamsa on top of a tall pole.", None),
            ("karawek", "Karawek", "การเวก", "A bird whose song is so sweet that every creature that hears it stops to listen. Drawn here as rings of sound.", None),
            ("garuda", "Garuda", "ครุฑ", "Half man, half eagle: Vishnu's mount and the enemy of the nagas. The garuda is the emblem on Thai government papers.", None),
            ("kinnari", "Kinnari", "กินรี", "Half woman, half bird. Manohra, a kinnari princess, marries Prince Suthon in a tale told from Lanna to the south. In the north, Shan (Tai Yai) dancers perform the kinnara dance, ฟ้อนนกกิ่งกะหรา, with wings and a tail strapped on.", None),
        ],
        "sources_h": "Sources",
        "sources_rec": "Recordings and photographs, from Wikimedia Commons",
        "sources_math": "Sun: NOAA solar calculator equations. Moon: Meeus, Astronomical Algorithms, chapters 47–48. Wan phra calendar for BE 2569: Thai PBS, the table the Coucal Clock carries. Places: Mot Dang.",
        "sources_facts": "Facts are written from field-guide knowledge; these were checked:",
        "foot": "Text CC BY 4.0, NaNoBotCo. Code MIT. Recordings and photographs keep their own licences.",
        "measure": {"m_lead": "This recording:", "m_secs": "{s} s", "m_calls": "{n} calls", "m_range": "{lo}–{hi} Hz", "m_pitch": "about {hz} Hz", "m_gap": "one every {g} s"},
        "now": "Now", "dock_stop": "Stop",
        "desc": "Birds of Chiang Mai, drawn by arithmetic under the live sky over Doi Suthep: 23 birds with real recordings, the Coucal Clock that calls at dawn and dusk, a chorus wheel, the mountain from moat to Doi Inthanon, and the birds of the Himmapan.",
        "photo_alt": "Photograph of a {n}",
        "lang_other": ("th/", "ไทย", "th"), "lang_this": "EN",
    },
    "th": {
        "title": "นกเชียงใหม่",
        "kicker": "Birds of Chiang Mai · วาดด้วยคณิตศาสตร์ ฟังเสียงจริง",
        "lede": "ท้องฟ้าเหนือดอยสุเทพ ณ ตอนนี้ คำนวณจากดวงอาทิตย์และดวงจันทร์ แตะที่นกเพื่อฟังเสียงร้องจริง",
        "slider": "เวลา", "now_btn": "ตอนนี้", "amb_off": "ให้นกร้องเอง", "amb_on": "นกร้องเองอยู่ · หยุด",
        "nav": [("sky", "ท้องฟ้า"), ("clock", "นาฬิกา"), ("birds", "นก"), ("chorus", "เสียงประสาน"), ("mountain-sec", "ขึ้นดอย"), ("legends", "ตำนาน"), ("sources", "ที่มา")],
        "clock_h": "นาฬิกานกกระปูด",
        "clock_th": "The Coucal Clock",
        "clock_p": [
            "นาฬิกากุ๊กกูที่นกเป็นนกกระปูดใหญ่ ร้องตอนรุ่งอรุณและพลบค่ำ คือตอนดวงอาทิตย์อยู่ใต้ขอบฟ้า 6 องศา คำนวณใหม่ทุกวันสำหรับสันทราย เวลาร้องจึงเลื่อนไปตามฤดู เหมือนนกกระปูดตัวจริง",
            "นาฬิกาเรือนนี้เป็นนาฬิกาไม้สักแกะสลักคู่หนึ่ง ทำให้วัดในสันทราย ที่เห็นนี้คือหน้าปัดของมัน วาดใหม่สำหรับเว็บ ตัวเลขไทย ปี พ.ศ. ข้างขึ้นข้างแรมนับจากปฏิทินวันพระที่ประกาศไว้ และช่องดวงจันทร์",
            "ช่องดวงจันทร์ทำงานแบบนาฬิกาเยอรมันและสวิสสมัยก่อน จานหนึ่งใบมีดวงจันทร์สองดวง หมุนครึ่งรอบต่อเดือนหลังเมฆสองก้อน สัดส่วนปรับให้ตรงกับดวงจันทร์จริง ส่วนสว่างที่เห็นคลาดไม่เกิน 1.1 จุด และจานตั้งต้นใหม่ทุกครั้งที่เดือนดับ",
        ],
        "next": "ร้องครั้งถัดไป", "dawn": "รุ่งอรุณ", "dusk": "พลบค่ำ", "in_": "อีก", "moon": "ดวงจันทร์", "lunar": "ข้างขึ้นข้างแรม",
        "call": "เรียกนกตอนนี้", "sound_off": "ให้ร้องเสียงดังตอนรุ่งอรุณและพลบค่ำ", "sound_on": "ร้องตอนรุ่งอรุณและพลบค่ำ · เปิดอยู่",
        "warp_off": "หนึ่งวันในหนึ่งนาที", "warp_on": "หนึ่งวันในหนึ่งนาที · หยุด",
        "waxing": "ข้างขึ้น", "waning": "ข้างแรม",
        "year_h": "เวลาร้องตลอดปี",
        "year_facts": "ปีนี้ที่สันทราย นกกระปูดร้องตอนเช้าเร็วที่สุดวันที่ {ed} เวลา {edt} และช้าที่สุดวันที่ {ld} เวลา {ldt} พลบค่ำเร็วที่สุดวันที่ {ek} เวลา {ekt} และช้าที่สุดวันที่ {lk} เวลา {lkt} เช้าที่เร็วที่สุดกับค่ำที่ช้าที่สุดไม่ตรงกับวันครีษมายัน คลาดไปหลายสัปดาห์ เพราะสมการเวลา คือดวงอาทิตย์เดินเร็วหรือช้ากว่านาฬิกา",
        "birds_h": "รู้จักนก",
        "birds_p": "นกทุกตัววาดจากตัวเลขไม่กี่สิบตัว ตัวเป็นวงรีกำลังสูง ปีกเป็นหยดน้ำ คอเป็นเส้นโค้งเบซิเย ลวดลายเป็นเกลียวและแถบ กดเล่นเพื่อฟังเสียงจริง นกจะอ้าปากตามความดังของเสียง แถบด้านล่างจอคือภาพสเปกโตรแกรม เสียงสูงอยู่ด้านบน สว่างคือดัง แล้วการ์ดจะนับเสียงในไฟล์ให้ดู คำนวณในเครื่องของคุณ",
        "chips": [("all", "ทั้งหมด"), ("town", "ในเมือง"), ("water", "ริมน้ำ"), ("fields", "ทุ่งนา"), ("forest", "ป่า"), ("mountain", "ดอยสูง"), ("night", "กลางคืน")],
        "listen": "ฟังเสียง", "fact": "รู้ไหม", "lore": "เรื่องเล่า", "where": "ลองไปฟังที่", "photo": "ภาพถ่าย", "play": "ฟัง", "no_rec": "ยังไม่มีเสียง",
        "rec": "เสียง", "by": "โดย",
        "chorus_h": "นกตัวไหนร้องตอนไหน",
        "chorus_p": "แต่ละวงคือนกหนึ่งชนิด ความหนาคือร้องมากแค่ไหนในชั่วโมงนั้น ปรับตามเวลาพระอาทิตย์ขึ้นและตกของเชียงใหม่วันนี้ เส้นแดงคือรุ่งอรุณและพลบค่ำ ลากเข็มไปรอบวัน แล้วกดเล่นเพื่อฟังชั่วโมงนั้น เส้นโค้งวาดจากนิสัยในคู่มือดูนก เป็นภาพร่างของวันธรรมดาวันหนึ่ง",
        "chorus_play": "ฟังชั่วโมงนี้", "chorus_stop": "หยุดเสียงประสาน", "quiet": "ชั่วโมงเงียบ", "ring_hint": "กดฟังเพื่อฟังชั่วโมงนี้",
        "at": [("dawn", "รุ่งอรุณ"), ("noon", "เที่ยง"), ("dusk", "พลบค่ำ"), ("midnight", "เที่ยงคืน")],
        "mountain_h": "ขึ้นดอย",
        "mountain_p": "จากคูเมืองราว 310 เมตร ถึงยอดดอยอินทนนท์ 2,565 เมตร แต่ละแท่งคือช่วงความสูงที่น่าจะเจอนกชนิดนั้น (โดยประมาณ) แตะที่นกเพื่อฟังเสียง",
        "legends_h": "นกในป่าหิมพานต์",
        "legends_p": "ป่าหิมพานต์อยู่เชิงเขาพระสุเมรุ เป็นบ้านของสัตว์ผสมที่วาดบนผนังวิหารและแกะบนหน้าบันทั่วล้านนา",
        "legends": [
            ("hatsadiling", "นกหัสดีลิงค์", "Hatsadiling", "นกในป่าหิมพานต์ หัวเป็นช้าง ในล้านนา พระเถระชั้นสูงหรือเจ้านายอาจได้รับการถวายเพลิงบนเมรุรูปนกหัสดีลิงค์ ปี 2551 เมรุของท่านจันทร์ กุสโล ประมุขสงฆ์ภาคเหนือ ตั้งที่วัดเจดีย์หลวง", "chedi_luang"),
            ("hamsa", "หงส์", "Hamsa", "พาหนะของพระพรหม และสัญลักษณ์ของหงสาวดี อาณาจักรมอญที่พะโค วัดแบบมอญและพม่าตั้งหงส์ไว้บนยอดเสาสูง", None),
            ("karawek", "นกการเวก", "Karawek", "นกที่ร้องเพราะจนสัตว์ทุกตัวที่ได้ยินต้องหยุดฟัง ในภาพนี้วาดเป็นวงเสียงที่แผ่ออกไป", None),
            ("garuda", "ครุฑ", "Garuda", "ครึ่งคนครึ่งนกอินทรี พาหนะของพระนารายณ์ และศัตรูของนาค ครุฑเป็นตราบนหนังสือราชการไทย", None),
            ("kinnari", "กินรี", "Kinnari", "ครึ่งหญิงครึ่งนก นางมโนห์ราเป็นกินรีที่ได้แต่งงานกับพระสุธน เรื่องนี้เล่ากันตั้งแต่ล้านนาถึงภาคใต้ ทางเหนือ ชาวไทใหญ่มีฟ้อนนกกิ่งกะหรา สวมปีกและหาง", None),
        ],
        "sources_h": "ที่มา",
        "sources_rec": "เสียงและภาพถ่าย จากวิกิมีเดียคอมมอนส์",
        "sources_math": "ดวงอาทิตย์: สมการของเครื่องคำนวณ NOAA ดวงจันทร์: Meeus, Astronomical Algorithms บทที่ 47–48 ปฏิทินวันพระ พ.ศ. 2569: ไทยพีบีเอส ตารางเดียวกับที่นาฬิกานกกระปูดใช้ สถานที่: มดแดง",
        "sources_facts": "ข้อมูลนกเขียนจากความรู้ในคู่มือดูนก ข้อเหล่านี้ตรวจสอบแล้ว:",
        "foot": "ข้อความ CC BY 4.0 NaNoBotCo โค้ด MIT เสียงและภาพถ่ายใช้สัญญาอนุญาตของเจ้าของ",
        "measure": {"m_lead": "ไฟล์เสียงนี้:", "m_secs": "{s} วินาที", "m_calls": "ร้อง {n} ครั้ง", "m_range": "{lo}–{hi} Hz", "m_pitch": "ราว {hz} Hz", "m_gap": "ทุก {g} วินาที"},
        "now": "ตอนนี้", "dock_stop": "หยุด",
        "desc": "นกเชียงใหม่ วาดด้วยคณิตศาสตร์ใต้ท้องฟ้าจริงเหนือดอยสุเทพ นก 23 ชนิดพร้อมเสียงจริง นาฬิกานกกระปูดที่ร้องตอนรุ่งอรุณและพลบค่ำ วงล้อเสียงประสาน ขึ้นดอยจากคูเมืองถึงดอยอินทนนท์ และนกในป่าหิมพานต์",
        "photo_alt": "ภาพถ่าย{n}",
        "lang_other": ("../", "EN", "en"), "lang_this": "ไทย",
    },
}

GOOGLE_ESCAPE = '<script>if(/[.]translate[.]goog$/.test(location.hostname))location.replace("https://"+location.hostname.slice(0,-15).replace(/--/g,"~").replace(/-/g,".").replace(/~/g,"-")+location.pathname+location.search.replace(/([?&])_x_tr_[^&]*/g,"$1").replace(/[?&]+$/,"").replace(/[?]&+/,"?")+location.hash)</script>'

CSS = open(os.path.join(HERE, "site.css")).read()


def lic(x):
    return f'<a href="{x["licence_url"]}">{E(x["licence"])}</a>' if x.get("licence_url") else E(x["licence"])


def card(b, lang, u):
    places = DATA["places"]
    t = lambda o: o[lang] if o else ""
    nm, other = (b["th"], b["en"]) if lang == "th" else (b["en"], b["th"])
    cr = CRED.get(b["slug"]) or {}
    a, im = cr.get("audio"), cr.get("img")
    out = [f'<article class="card" data-slug="{b["slug"]}" id="b-{b["slug"]}">']
    out.append(f'<div class="stage"><canvas aria-label="{E(nm)}" role="img"></canvas>')
    if a:
        out.append(f'<button class="play" type="button" aria-label="{E(u["play"])} {E(nm)}"><span class="ico" aria-hidden="true"></span>{E(u["play"])}</button>')
    else:
        out.append(f'<span class="norec">{E(u["no_rec"])}</span>')
    out.append('</div><div class="txt">')
    out.append(f'<h3>{E(nm)}</h3><p class="sub"><span class="o">{E(other)}</span> · <i>{E(b["sci"])}</i></p><p class="rom">{E(b["rom"])} · {b["cm"]} cm</p>')
    out.append(f'<p class="measure" data-measure="{b["slug"]}" hidden></p>')
    out.append(f'<dl><dt>{E(u["listen"])}</dt><dd>{E(t(b["listen"]))}</dd><dt>{E(u["fact"])}</dt><dd>{E(t(b["fact"]))}</dd>')
    if b.get("lore"):
        out.append(f'<dt>{E(u["lore"])}</dt><dd>{E(t(b["lore"]))}</dd>')
    if b.get("places"):
        links = " · ".join(f'<a href="{places[p]["href"]}">{E(places[p][lang])}</a>' for p in b["places"])
        out.append(f'<dt>{E(u["where"])}</dt><dd>{links}</dd>')
    out.append('</dl>')
    if im:
        out.append(f'<details><summary>{E(u["photo"])}</summary><img loading="lazy" src="{u["root"]}{im["file"]}" width="{im["w"]}" height="{im["h"]}" alt="{E(u["photo_alt"].format(n=nm))}">'
                   f'<p class="cred"><a href="{im["page"]}">{E(im["author"])}</a> · {lic(im)}</p></details>')
    if a:
        out.append(f'<p class="cred">{E(u["rec"])} {E(u["by"])} <a href="{a["page"]}">{E(a["author"])}</a> · {lic(a)}</p>')
    out.append('</div></article>')
    return "".join(out)


def page(lang):
    u = dict(UI[lang])
    root = "" if lang == "en" else "../"
    u["root"] = root
    url = BASE if lang == "en" else BASE + "th/"
    ui_js = {k: u[k] for k in ("now", "amb_on", "amb_off", "dawn", "dusk", "in_", "waxing", "waning", "sound_on", "sound_off", "warp_on", "warp_off",
                                "year_facts", "chorus_play", "chorus_stop", "quiet", "ring_hint")}
    ui_js.update(u["measure"])
    nav = "".join(f'<a href="#{a}">{E(b)}</a>' for a, b in u["nav"])
    ol = u["lang_other"]
    head = f'''<!doctype html><html lang="{lang}" data-root="{root}" translate="no" class="notranslate"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="google" content="notranslate"><meta name="robots" content="notranslate">
{GOOGLE_ESCAPE}
<title>{E(u["title"])} · {"นกเชียงใหม่" if lang == "en" else "Birds of Chiang Mai"}</title>
<meta name="description" content="{E(u["desc"])}">
<meta name="theme-color" content="#1b2347">
<link rel="canonical" href="{url}">
<link rel="alternate" hreflang="en" href="{BASE}"><link rel="alternate" hreflang="th" href="{BASE}th/"><link rel="alternate" hreflang="x-default" href="{BASE}">
<meta property="og:type" content="website"><meta property="og:site_name" content="Birds of Chiang Mai · นกเชียงใหม่">
<meta property="og:title" content="{E(u["title"])}"><meta property="og:description" content="{E(u["desc"])}"><meta property="og:url" content="{url}">
<meta property="og:image" content="{BASE}card.jpg"><meta property="og:image:secure_url" content="{BASE}card.jpg"><meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Birds of Chiang Mai drawn by arithmetic on a wire at dusk, Doi Suthep behind">
<meta property="og:locale" content="{"en_US" if lang == "en" else "th_TH"}"><meta property="og:locale:alternate" content="{"th_TH" if lang == "en" else "en_US"}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="{BASE}card.jpg">
<link rel="icon" href="{root}icon.svg" type="image/svg+xml">
<link rel="alternate" type="text/plain" href="{BASE}llms.txt" title="llms.txt">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Noto+Sans+Thai:wght@400;600;700&family=Noto+Serif+Thai:wght@600;700&display=swap" rel="stylesheet">
<style>{CSS}</style>
</head><body>
<header class="top"><div class="in"><a class="brand" href="#sky"><svg viewBox="0 0 32 32" aria-hidden="true"><use href="#mark"/></svg><span>{E(u["title"])}</span></a>
<nav aria-label="Sections">{nav}</nav>
<span class="lang"><b>{E(u["lang_this"])}</b> | <a href="{ol[0]}" hreflang="{ol[2]}" data-lang="{ol[2]}">{E(ol[1])}</a></span></div></header>
<svg width="0" height="0" style="position:absolute"><symbol id="mark" viewBox="0 0 32 32"><circle cx="16" cy="16" r="15" fill="#1b2347"/><path d="M6 20c4-1 6-6 11-6 3 0 5 2 6 4l4 1-4 1c-1 2-4 3-7 3-4 0-6-2-10-3z" fill="#e8b54a"/><circle cx="21" cy="17" r="1.1" fill="#b5231c"/></symbol></svg>
'''
    hero = f'''<section id="sky" class="hero"><canvas id="scene" aria-label="{E(u["lede"])}"></canvas>
<div class="hero-t"><p class="kick">{E(u["kicker"])}</p><h1>{E(u["title"])}</h1><p class="lede">{E(u["lede"])}</p><p class="cardline">นกเชียงใหม่ · 23 birds, real calls · the Coucal Clock<br><span>nanobotco.github.io/birds-chiang-mai</span></p></div>
<div class="tbar"><label for="tslider" class="sr">{E(u["slider"])}</label><input id="tslider" type="range" min="0" max="1439" step="1" value="720">
<span id="tlabel" class="tl" aria-live="polite"></span><button id="tnow" type="button" hidden>{E(u["now_btn"])}</button><button id="tamb" type="button" aria-pressed="false">{E(u["amb_off"])}</button></div></section>
'''
    clock = f'''<section id="clock" class="sec clocksec"><div class="in two">
<div class="clockwrap"><canvas id="clockface" class="clockcv" role="img" aria-label="{E(u["clock_h"])}"></canvas></div>
<div><p class="kick">{E(u["clock_th"])}</p><h2>{E(u["clock_h"])}</h2>
<div class="panel"><div><span class="k">{E(u["next"])}</span><b id="c-next">–</b></div><div><span class="k">{E(u["dawn"])}</span><b id="c-dawn">–</b></div><div><span class="k">{E(u["dusk"])}</span><b id="c-dusk">–</b></div><div><span class="k">{E(u["moon"])}</span><b id="c-moon">–</b></div><div><span class="k">{E(u["lunar"])}</span><b id="c-lunar">–</b></div></div>
<div class="btns"><button id="c-call" class="pill hot" type="button">{E(u["call"])}</button><button id="c-sound" class="pill" type="button" aria-pressed="false">{E(u["sound_off"])}</button><button id="c-warp" class="pill" type="button" aria-pressed="false">{E(u["warp_off"])}</button></div>
{"".join(f"<p>{E(p)}</p>" for p in u["clock_p"])}
</div></div>
<div class="in"><h3>{E(u["year_h"])}</h3><canvas id="year" class="yearcv"></canvas><p id="year-hover" class="hov" aria-live="polite"></p><p id="year-facts"></p></div></section>
'''
    chips = "".join(f'<button type="button" data-f="{k}" aria-pressed="{"true" if k == "all" else "false"}">{E(v)}</button>' for k, v in u["chips"])
    birds = f'''<section id="birds" class="sec"><div class="in"><h2>{E(u["birds_h"])}</h2><p class="intro">{E(u["birds_p"])}</p>
<div class="chips" role="group">{chips}</div>
<div class="grid">{"".join(card(b, lang, u) for b in DATA["birds"])}</div></div></section>
'''
    ats = "".join(f'<button type="button" class="pill sm" data-at="{k}">{E(v)}</button>' for k, v in u["at"])
    chorus = f'''<section id="chorus" class="sec night"><div class="in two">
<div class="ringwrap"><canvas id="ring" tabindex="0" role="img" aria-label="{E(u["chorus_h"])}"></canvas></div>
<div><h2>{E(u["chorus_h"])}</h2><p>{E(u["chorus_p"])}</p><p class="big"><b id="ch-time">–</b></p><p id="ch-top" class="top3" aria-live="polite"></p>
<div class="btns">{ats}</div><div class="btns"><button id="ch-play" class="pill hot" type="button" aria-pressed="false">{E(u["chorus_play"])}</button></div></div></div></section>
'''
    places = DATA["places"]
    mlinks = " · ".join(f'<a href="{places[k]["href"]}">{E(places[k][lang])} ({places[k]["alt"]:,} m)</a>' for k in ("moat", "wat_suthep", "suthep", "chiangdao", "phahompok", "inthanon"))
    mountain = f'''<section id="mountain-sec" class="sec"><div class="in"><h2>{E(u["mountain_h"])}</h2><p class="intro">{E(u["mountain_p"])}</p>
<canvas id="mountain" class="mtn"></canvas><p class="links">{mlinks}</p></div></section>
'''
    lg = []
    for key, n1, n2, txt, pl in u["legends"]:
        if key == "hatsadiling":
            fig = f'<img loading="lazy" src="{root}img/hatsadiling.jpg" width="1000" height="768" alt="{E(n1)}"><p class="cred"><a href="https://commons.wikimedia.org/wiki/File:Chan_Kusalo_cremation_04.jpg">Takeaway</a> · <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a></p>'
        else:
            fig = f'<canvas data-glyph="{key}" role="img" aria-label="{E(n1)}"></canvas>'
        link = f' <a href="{places[pl]["href"]}">{E(places[pl][lang])}</a>' if pl else ""
        lg.append(f'<article class="leg"><div class="fig">{fig}</div><h3>{E(n1)}</h3><p class="sub">{E(n2)}</p><p>{E(txt)}{link}</p></article>')
    legends = f'''<section id="legends" class="sec lanna"><div class="in"><h2>{E(u["legends_h"])}</h2><p class="intro">{E(u["legends_p"])}</p><div class="legs">{"".join(lg)}</div></div></section>
'''
    rows = []
    for b in DATA["birds"]:
        c = CRED.get(b["slug"]) or {}
        nm = b["th"] if lang == "th" else b["en"]
        bits = []
        if c.get("audio"):
            a = c["audio"]
            bits.append(f'♪ <a href="{a["page"]}">{E(a["author"])}</a>, {lic(a)}' + (f', {E(a["recorded"])}' if a.get("recorded") else ""))
        if c.get("img"):
            i = c["img"]
            bits.append(f'◐ <a href="{i["page"]}">{E(i["author"])}</a>, {lic(i)}')
        if bits:
            rows.append(f'<li><b>{E(nm)}</b> — {" · ".join(bits)}</li>')
    facts = "".join(f'<li><a href="{s["href"]}">{E(s["en"])}</a></li>' for s in DATA.get("sources", {}).values())
    sources = f'''<section id="sources" class="sec"><div class="in"><h2>{E(u["sources_h"])}</h2>
<h3>{E(u["sources_rec"])}</h3><ul class="src">{"".join(rows)}<li><b>{"นกหัสดีลิงค์" if lang == "th" else "Hatsadiling"}</b> — ◐ <a href="https://commons.wikimedia.org/wiki/File:Chan_Kusalo_cremation_04.jpg">Takeaway</a>, <a href="https://creativecommons.org/licenses/by-sa/3.0">CC BY-SA 3.0</a></li></ul>
<p>{E(u["sources_math"])} <a href="https://motdang.net/">motdang.net</a></p>
<p>{E(u["sources_facts"])}</p><ul class="src">{facts}</ul></div></section>
'''
    dock = f'''<div id="dock" aria-live="polite"><canvas></canvas><div class="dl"><span class="dn"></span><span class="dh"></span></div><button type="button">{E(u["dock_stop"])}</button></div>
<footer class="bot"><div class="in">{E(u["foot"])} · <a href="https://github.com/NaNoBotCo/birds-chiang-mai">GitHub</a> · <a href="https://motdang.net/">motdang.net</a></div></footer>
<script>window.UI={json.dumps(ui_js, ensure_ascii=False)};</script>
<script src="{root}data.js"></script><script src="{root}sky.js"></script><script src="{root}bird.js"></script><script src="{root}app.js"></script><script src="{root}top.js"></script>
</body></html>
'''
    return head + "<main>" + hero + clock + birds + chorus + mountain + legends + sources + "</main>" + dock


def main():
    os.makedirs(os.path.join(DOCS, "th"), exist_ok=True)
    with open(os.path.join(DOCS, "data.js"), "w") as f:
        f.write("window.BIRDS=" + json.dumps(DATA, ensure_ascii=False) + ";\nwindow.CREDITS=" + json.dumps(CRED, ensure_ascii=False) + ";\n")
    for lang, path in (("en", "index.html"), ("th", "th/index.html")):
        with open(os.path.join(DOCS, path), "w") as f:
            f.write(page(lang))
    with open(os.path.join(DOCS, "sitemap.xml"), "w") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
                f'<url><loc>{BASE}</loc></url>\n<url><loc>{BASE}th/</loc></url>\n</urlset>\n')
    with open(os.path.join(DOCS, "robots.txt"), "w") as f:
        f.write(f"User-agent: *\nAllow: /\nSitemap: {BASE}sitemap.xml\n")
    lines = ["# Birds of Chiang Mai · นกเชียงใหม่", "", UI["en"]["desc"], "", f"English: {BASE}", f"Thai: {BASE}th/", "", "## Birds", ""]
    for b in DATA["birds"]:
        lines.append(f'- {b["en"]} ({b["th"]}, {b["rom"]}), {b["sci"]}, {b["cm"]} cm. Listen for: {b["listen"]["en"]} {b["fact"]["en"]}' + (f' {b["lore"]["en"]}' if b.get("lore") else ""))
    lines += ["", "## Licence", "", "Text CC BY 4.0, NaNoBotCo. Code MIT. Recordings and photographs keep their own licences, listed on the page.", ""]
    with open(os.path.join(DOCS, "llms.txt"), "w") as f:
        f.write("\n".join(lines))
    print("built", len(DATA["birds"]), "birds;", sum(1 for c in CRED.values() if c.get("audio")), "recordings;", sum(1 for c in CRED.values() if c.get("img")), "photos")


if __name__ == "__main__":
    main()
