from selenium import webdriver
from selenium.webdriver.common.by import By
from urllib.parse import quote
from datetime import datetime
import json
import csv
import os
import time

CSV_FILE = "image_urls.csv"

keyword = input("検索キーワードを入力してください: ")

# 取得件数を入力（1以上の整数になるまで聞き直す）
while True:
    raw = input("取得件数を入力してください: ")
    try:
        LIMIT = int(raw)
        if LIMIT > 0:
            break
    except ValueError:
        pass
    print("1以上の整数を入力してください。")

# 重複チェック: 既存CSVから「同じキーワード」のURLを読み込んでおく
seen = set()
if os.path.exists(CSV_FILE):
    with open(CSV_FILE, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f)
        next(reader, None)  # ヘッダーを飛ばす
        for row in reader:
            # row = [date, source, keyword, image_url]
            if len(row) >= 4 and row[2] == keyword:
                seen.add(row[3])
    if seen:
        print(f"同じキーワードの既存URL {len(seen)}件を重複チェック対象に読み込みました。")

search_url = f"https://www.bing.com/images/search?q={quote(keyword)}"

driver = webdriver.Chrome()
driver.set_window_size(1600, 1200)
driver.get(search_url)
time.sleep(3)

image_urls = []      # 今回あらたに取得したURL
last_count = 0
stale_rounds = 0     # 何回スクロールしても増えなかった回数

# 件数がたまるか、増えなくなるまで繰り返す
while len(image_urls) < LIMIT and stale_rounds < 5:
    # ポイント: <img> ではなく a.iusc の m 属性(JSON)から元画像URLを取る
    anchors = driver.find_elements(By.CSS_SELECTOR, "a.iusc")
    for a in anchors:
        m = a.get_attribute("m")
        if not m:
            continue
        try:
            data = json.loads(m)
        except json.JSONDecodeError:
            continue

        murl = data.get("murl")  # murl = 元画像のURL（turl はサムネイル）
        if not murl or not murl.startswith("http"):
            continue
        if murl in seen:  # 同じキーワードで既出のURLはここで弾かれる
            continue

        seen.add(murl)
        image_urls.append(murl)
        if len(image_urls) >= LIMIT:
            break

    print(f"取得済み: {len(image_urls)}件")
    if len(image_urls) >= LIMIT:
        break

    # 増えていなければ stale をカウント、増えていればリセット
    if len(image_urls) == last_count:
        stale_rounds += 1
    else:
        stale_rounds = 0
    last_count = len(image_urls)

    # 一番下までスクロールして次の読み込みを待つ
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(2)

driver.quit()

image_urls = image_urls[:LIMIT]

file_exists = os.path.exists(CSV_FILE)
with open(CSV_FILE, "a", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    if not file_exists:
        writer.writerow(["date", "source", "keyword", "image_url"])
    for image_url in image_urls:
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d"),
            "bing-original",
            keyword,
            image_url
        ])

print(f"{len(image_urls)}件の画像URLを {CSV_FILE} に保存しました。")
