from selenium import webdriver
from urllib.parse import quote, unquote
from datetime import datetime
import csv
import os
import time
import re

LIMIT = 10
CSV_FILE = "image_urls.csv"

keyword = input("検索キーワードを入力してください: ")

search_url = f"https://www.google.com/search?q={quote(keyword)}&tbm=isch"

driver = webdriver.Chrome()
driver.set_window_size(1600, 1200)
driver.get(search_url)

time.sleep(5)

for scroll_y in [0, 800, 1600, 2400, 3200]:
    driver.execute_script(f"window.scrollTo(0, {scroll_y});")
    time.sleep(1)

html = driver.page_source
driver.quit()

# Google画像検索のHTML内から画像URL候補を探す
matches = re.findall(r'https?://[^"\']+\.(?:jpg|jpeg|png|webp)', html)

image_urls = []

for url in matches:
    url = unquote(url)

    if "google" in url:
        continue

    if url in image_urls:
        continue

    image_urls.append(url)

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
            "google",
            keyword,
            image_url
        ])

print(f"取得済み: {len(image_urls)}件")
print(f"{len(image_urls)}件の画像URLを {CSV_FILE} に保存しました。")

