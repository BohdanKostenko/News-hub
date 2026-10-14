import os
import re
import json
import time
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
import feedparser

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
NTFY_TOPIC = os.environ.get("NTFY_TOPIC", "my_personal_news_alerts")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
}

def parse_iso_datetime(dt_str):
    if not dt_str:
        return datetime.now(timezone.utc)
    try:
        clean = dt_str.replace("Z", "+00:00")
        return datetime.fromisoformat(clean)
    except Exception:
        return datetime.now(timezone.utc)

def send_push_notification(title, summary, url):
    if not NTFY_TOPIC:
        return
    try:
        requests.post(
            f"https://ntfy.sh/{NTFY_TOPIC}",
            data=summary.encode("utf-8"),
            headers={
                "Title": title.encode("utf-8"),
                "Priority": "urgent",
                "Tags": "warning,newspaper",
                "Click": url
            },
            timeout=10
        )
    except Exception as e:
        print(f"Помилка push: {e}")

def parse_telegram(url, limit=5):
    m = re.search(r"t\.me/(?:s/)?([a-zA-Z0-9_]+)", url)
    if not m:
        return []
    clean_name = m.group(1)
    target_url = f"https://t.me/s/{clean_name}"

    try:
        r = requests.get(target_url, headers=HEADERS, timeout=15)
        if r.status_code != 200:
            return []
    except Exception:
        return []

    soup = BeautifulSoup(r.text, "html.parser")
    posts = soup.find_all("div", class_="tgme_widget_message")
    result = []

    for post in posts[-limit:]:
        data_post = post.get("data-post")
        if not data_post:
            continue
        text_wrap = post.find("div", class_="tgme_widget_message_text")
        if not text_wrap:
            continue

        for br in text_wrap.find_all("br"):
            br.replace_with("\n")
        raw_text = text_wrap.get_text(separator="\n").strip()

        time_tag = post.find("time")
        published_at = ""
        if time_tag:
            published_at = time_tag.get("datetime", "")
        if not published_at:
            time_a = post.find("a", class_="tgme_widget_message_date")
            if time_a and time_a.find("time"):
                published_at = time_a.find("time").get("datetime", "")
        if not published_at:
            published_at = datetime.now(timezone.utc).isoformat()

        # Збір медіа без дублікатів
        media_list = []
        seen_urls = set()

        video_tags = post.find_all("video", class_="tgme_widget_message_video")
        for v in video_tags:
            src = v.get("src")
            if src and src not in seen_urls:
                seen_urls.add(src)
                media_list.append({"type": "video", "url": src})

        photo_tags = post.find_all("a", class_="tgme_widget_message_photo_wrap")
        for p in photo_tags:
            style_str = p.get("style", "")
            pm = re.search(r"url\(([^)]+)\)", style_str)
            if pm:
                u = pm.group(1)
                # Якщо є відео, постер-прев'ю не додаємо як окреме фото
                if u not in seen_urls and not video_tags:
                    seen_urls.add(u)
                    media_list.append({"type": "image", "url": u})

        result.append({
            "id": data_post.replace("/", "_"),
            "source_name": f"@{clean_name}",
            "source_url": f"https://t.me/{data_post}",
            "raw_text": raw_text,
            "published_at": published_at,
            "media_list": media_list
        })
    return result

def parse_website_or_rss(url, limit=5):
    xml_content = None
    try:
        r = requests.get(url, headers=HEADERS, timeout=15)
        if r.status_code == 200 and ("xml" in r.headers.get("content-type", "") or "<rss" in r.text or "<feed" in r.text):
            xml_content = r.content
    except Exception:
        pass

    feed = feedparser.parse(xml_content if xml_content else url)
    if not feed.entries and not url.endswith(('.xml', '.rss')):
        for extra in ["/rss", "/feed", "/rss.xml", "/feeds/news.rss"]:
            alt_url = url.rstrip('/') + extra
            test_feed = feedparser.parse(alt_url)
            if test_feed.entries:
                feed = test_feed
                break

    result = []
    if feed.entries:
        source_title = feed.feed.get("title", url)
        for entry in feed.entries[:limit]:
            post_id = entry.get("id") or entry.get("link")
            post_id = re.sub(r'[^a-zA-Z0-9_]', '_', post_id)[-30:]
            
            raw_text = entry.get("summary") or entry.get("description") or entry.get("title", "")
            soup = BeautifulSoup(raw_text, "html.parser")
            clean_text = soup.get_text(separator=" ").strip()

            media_list = []
            if "media_content" in entry:
                for mc in entry.media_content:
                    if mc.get("url"):
                        media_list.append({"type": "image", "url": mc["url"]})
            if "enclosures" in entry:
                for enc in entry.enclosures:
                    if enc.get("href"):
                        media_list.append({"type": "image", "url": enc["href"]})

            pub = entry.get("published", "") or entry.get("updated", "")
            try:
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    dt = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                    pub = dt.isoformat()
            except Exception:
                pass
            if not pub:
                pub = datetime.now(timezone.utc).isoformat()

            result.append({
                "id": f"rss_{post_id}",
                "source_name": source_title[:25],
                "source_url": entry.get("link", url),
                "raw_text": f"{entry.get('title', '')}\n\n{clean_text}",
                "published_at": pub,
                "media_list": media_list
            })
    return result

def route_parser(url, limit=5):
    url_lower = url.lower()
    if "t.me/" in url_lower:
        return parse_telegram(url, limit=limit)
    else:
        return parse_website_or_rss(url, limit=limit)

def query_gemini_safe(prompt):
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key={GEMINI_KEY}"
    headers = {"Content-Type": "application/json"}
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1
        }
    }

    for attempt in range(4):
        try:
            res = requests.post(url, headers=headers, json=payload, timeout=35)
            if res.status_code == 200:
                data = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                return json.loads(data)
            elif res.status_code == 429:
                wait_time = 15 * (attempt + 1)
                print(f"[RateLimit 429] Перевищено ліміт запитів. Очікування {wait_time} сек...")
                time.sleep(wait_time)
                continue
            elif res.status_code == 503:
                time.sleep(5)
                continue
            else:
                return None
        except Exception as e:
            time.sleep(3)
    return None

def process_batch(items):
    """Обробляє до 5 новин в одному запиті до Gemini для економії ліміту RPM та RPD."""
    formatted_items = []
    for idx, item in enumerate(items):
        formatted_items.append(f"--- НОВИНА ID: {idx} ---\n{item['raw_text'][:1200]}")

    prompt = (
        "Ти — редактор новин. Проаналізуй список дописів нижче. "
        "Для кожного з них виріши, чи це реклама/спам (is_ad: true), або новина.\n"
        "Поверни JSON масив об'єктів формату:\n"
        "[\n"
        "  {\n"
        "    \"index\": 0,\n"
        "    \"is_ad\": false,\n"
        "    \"title\": \"Короткий нейтральний заголовок\",\n"
        "    \"summary\": \"Суть у 2 реченнях (факти)\",\n"
        "    \"category\": \"Місто\",\n"
        "    \"tags\": [\"тег1\"],\n"
        "    \"importance\": 1\n"
        "  }\n"
        "]\n"
        "importance: 5 (обстріли, небезпека), 4 (відключення світла, ДТП), 1-3 (звичайні).\n\n"
        + "\n\n".join(formatted_items)
    )

    res = query_gemini_safe(prompt)
    if isinstance(res, list):
        return res
    return []

def generate_digest(articles):
    if not articles:
        return []
    titles = [f"- {a['title']}: {a['summary']}" for a in articles[:8]]
    prompt = (
        "Склади лаконічний ранковий дайджест із 3-5 головних фактів на основі списку подій.\n"
        "Поверни JSON:\n"
        "{\"bullet_points\": [\"теза 1\", \"теза 2\", \"теза 3\"]}\n\n"
        "Події:\n" + "\n".join(titles)
    )
    res = query_gemini_safe(prompt)
    return res.get("bullet_points", []) if isinstance(res, dict) else []

def are_similar_articles(a1, a2):
    t1 = parse_iso_datetime(a1.get("published_at"))
    t2 = parse_iso_datetime(a2.get("published_at"))
    if abs((t1 - t2).total_seconds()) > 43200:
        return False
    w1 = set(re.findall(r'\b[а-яіїєґa-z]{4,}\b', a1["title"].lower()))
    w2 = set(re.findall(r'\b[а-яіїєґa-z]{4,}\b', a2["title"].lower()))
    return len(w1.intersection(w2)) >= 2

def cluster_and_deduplicate(articles):
    clustered = []
    for art in articles:
        matched = False
        for main_art in clustered:
            if are_similar_articles(art, main_art):
                src_entry = {"source_name": art["source_name"], "source_url": art["source_url"], "raw_text": art.get("raw_text", ""), "published_at": art.get("published_at", "")}
                if src_entry not in main_art.setdefault("related_sources", []):
                    main_art["related_sources"].append(src_entry)
                if not main_art.get("media_list") and art.get("media_list"):
                    main_art["media_list"] = art["media_list"]
                main_art["importance"] = max(main_art.get("importance", 1), art.get("importance", 1))
                matched = True
                break
        if not matched:
            art.setdefault("related_sources", [])
            clustered.append(art)
    return clustered

def main():
    if not GEMINI_KEY:
        print("Встановіть змінну: export GEMINI_API_KEY='ваш_ключ'")
        return

    sources = []
    if os.path.exists("sources.json"):
        with open("sources.json", "r", encoding="utf-8") as f:
            try:
                sources = json.load(f)
            except Exception:
                sources = []
    
    if not sources:
        sources = [{"url": "https://t.me/s/ok_kremen", "limit": 4}]

    existing_data = {"digest": [], "articles": []}
    if os.path.exists("data.json"):
        try:
            with open("data.json", "r", encoding="utf-8") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    existing_data = loaded
                elif isinstance(loaded, list):
                    existing_data["articles"] = loaded
        except Exception:
            pass

    existing_ids = {a["id"] for a in existing_data.get("articles", [])}
    pending_items = []

    # 1. Збір сирих постів
    for src in sources:
        target_url = src.get("url") if isinstance(src, dict) else src
        if not target_url:
            continue
        limit = src.get("limit", 4) if isinstance(src, dict) else 4
        print(f"Збір: {target_url}...")
        raw_items = route_parser(target_url, limit=limit)
        for item in raw_items:
            if item["id"] not in existing_ids:
                pending_items.append(item)

    print(f"Знайдено нових постів для обробки: {len(pending_items)}")

    # 2. Пакетна обробка пачками по 4 штуки (економія до 80% запитів)
    new_articles = []
    batch_size = 4
    for i in range(0, len(pending_items), batch_size):
        chunk = pending_items[i:i + batch_size]
        print(f"Аналіз ШІ (пачка {i//batch_size + 1}/{(len(pending_items)-1)//batch_size + 1})...")
        results = process_batch(chunk)

        for res in results:
            idx = res.get("index")
            if idx is not None and 0 <= idx < len(chunk) and not res.get("is_ad"):
                raw_it = chunk[idx]
                art = {
                    "id": raw_it["id"],
                    "source_name": raw_it["source_name"],
                    "source_url": raw_it["source_url"],
                    "published_at": raw_it["published_at"],
                    "raw_text": raw_it["raw_text"],
                    "title": res.get("title"),
                    "summary": res.get("summary"),
                    "category": res.get("category"),
                    "tags": res.get("tags", []),
                    "importance": res.get("importance", 1),
                    "media_list": raw_it["media_list"],
                    "related_sources": []
                }
                new_articles.append(art)
                if art["importance"] >= 4:
                    send_push_notification(art["title"], art["summary"], art["source_url"])

        # Безпечна пауза між пачками, щоб ніколи не перевищувати 15 RPM
        time.sleep(4.5)

    combined_articles = new_articles + existing_data.get("articles", [])

    cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    recent_articles = [a for a in combined_articles if parse_iso_datetime(a.get("published_at")) >= cutoff]
    recent_articles.sort(key=lambda a: parse_iso_datetime(a.get("published_at")), reverse=True)
    clustered_articles = cluster_and_deduplicate(recent_articles)

    digest = existing_data.get("digest", [])
    if new_articles or not digest:
        print("Оновлення дайджесту...")
        digest = generate_digest(clustered_articles[:8])

    final_payload = {
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M"),
        "digest": digest,
        "articles": clustered_articles
    }

    with open("data.json", "w", encoding="utf-8") as f:
        json.dump(final_payload, f, ensure_ascii=False, indent=2)

    print(f"\nУспіх! Додано {len(new_articles)} нових новин (загалом {len(clustered_articles)}).")

if __name__ == "__main__":
    main()
