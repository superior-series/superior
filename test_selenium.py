from selenium import webdriver

driver = webdriver.Chrome()

driver.get("https://www.bing.com")

print(driver.title)

driver.quit()
