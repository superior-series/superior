import requests
import csv
import os
import re
from datetime import datetime
from urllib.parse import quote

LIMIT = 10
CSV_FILE = "image_urls.csv"

keyword = input("検索キーワードを入力してください: ")

headers = {
    "User-Agent": "Mozilla/5.0"
}

# 1. DuckDuckGo検索ページから vqd トークンを取得
search_url = f"https://duckduckgo.com/?q={quote(keyword)}&iax=images&ia=images"

res = requests.get(search_url, headers=headers, timeout=15)
res.raise_for_status()

match = re.search(r'vqd="([^"]+)"', res.text)

if not match:
    match = re.search(r"vqd='([^']+)'", res.text)

if not match:
    print("vqdトークンを取得できませんでした。")
    exit()

vqd = match.group(1)

# 2. 画像検索JSONを取得
api_url = "https://duckduckgo.com/i.js"

params = {
    "l": "jp-ja",
    "o": "json",
    "q": keyword,
    "vqd": vqd,
    "f": ",,,",
    "p": "1"
}

res = requests.get(api_url, headers=headers, params=params, timeout=15)
res.raise_for_status()

data = res.json()

image_urls = []

for item in data.get("results", []):
    image_url = item.get("image")

    if not image_url:
        continue

    if image_url in image_urls:
        continue

    image_urls.append(image_url)

    if len(image_urls) >= LIMIT:
        break

file_exists = os.path.exists(CSV_FILE)

with open(CSV_FILE, "a", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)

    if not file_exists:
        writer.writerow(["date", "source", "keyword", "image_url"])

    for image_url in image_urls:
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d"),
            "duckduckgo",
            keyword,
            image_url
        ])

print(f"取得済み: {len(image_urls)}件")
print(f"{len(image_urls)}件のDuckDuckGo画像URLを {CSV_FILE} に保存しました。")

