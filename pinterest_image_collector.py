from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.common.exceptions import (
    NoSuchElementException,
    StaleElementReferenceException,
    WebDriverException,
)
from urllib.parse import quote
from datetime import datetime
import csv
import os
import time

CSV_FILE = "image_urls.csv"


def csv_safe(value):
    """CSVインジェクション対策: 数式として解釈されうる先頭文字を無害化する"""
    s = str(value)
    if s and s[0] in ("=", "+", "-", "@"):
        s = "'" + s
    return s


def dismiss_modal(driver):
    """ログイン等のモーダルを安全に閉じる。閉じるボタンだけを狙い、見つからなければ何もしない"""
    selectors = [
        "//button[@aria-label='閉じる']",
        "//button[@aria-label='Close']",
        "//div[@role='dialog']//button[contains(@aria-label, '閉じ')]",
        "//div[@role='dialog']//button[contains(@aria-label, 'Close')]",
    ]
    for xp in selectors:
        try:
            driver.find_element(By.XPATH, xp).click()
            time.sleep(1.5)
            return True
        except (NoSuchElementException, WebDriverException):
            continue
    return False


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

search_url = f"https://www.pinterest.com/search/pins/?q={quote(keyword)}"

image_urls = []  # 今回あらたに取得したURL

driver = webdriver.Chrome()
try:
    driver.set_window_size(1600, 1200)
    driver.get(search_url)
    time.sleep(5)

    # ログイン等のモーダルが出ていたら閉じる
    dismiss_modal(driver)

    last_count = 0
    stale_rounds = 0  # 何回スクロールしても増えなかった回数

    while len(image_urls) < LIMIT and stale_rounds < 5:
        imgs = driver.find_elements(By.TAG_NAME, "img")
        for img in imgs:
            try:
                src = img.get_attribute("src")
            except StaleElementReferenceException:
                continue

            if not src or not src.startswith("http"):
                continue
            if "i.pinimg.com" not in src:
                continue
            if "/60x60/" in src:  # 極小サムネイルは除外
                continue
            if src in seen:
                continue

            seen.add(src)
            image_urls.append(src)
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

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(2)
finally:
    driver.quit()  # 何があってもブラウザを閉じる

image_urls = image_urls[:LIMIT]

file_exists = os.path.exists(CSV_FILE)
with open(CSV_FILE, "a", newline="", encoding="utf-8-sig") as f:
    writer = csv.writer(f)
    if not file_exists:
        writer.writerow(["date", "source", "keyword", "image_url"])
    for image_url in image_urls:
        writer.writerow([
            datetime.now().strftime("%Y-%m-%d"),
            "pinterest",
            csv_safe(keyword),
            csv_safe(image_url),
        ])

print(f"{len(image_urls)}件のPinterest画像URLを {CSV_FILE} に保存しました。")
