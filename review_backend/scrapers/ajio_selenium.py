from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
from urllib.parse import urljoin
from utils.driver import get_driver

MAX_RESULTS = int(os.getenv("SCRAPER_RESULTS_PER_STORE", "8"))


def _to_float(raw_value):
    if not raw_value:
        return None
    cleaned = (
        raw_value.replace("₹", "")
        .replace(",", "")
        .strip()
    )
    try:
        return float(cleaned)
    except ValueError:
        return None

def search_ajio_selenium(query):
    driver = get_driver()
    results = []

    try:
        url = f"https://www.ajio.com/search/?text={query.replace(' ', '%20')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "div.rilrtl-products-list__item")
            )
        )

        items = driver.find_elements(By.CSS_SELECTOR, "div.rilrtl-products-list__item")

        for index, item in enumerate(items[:MAX_RESULTS], start=1):
            try:
                title = item.find_element(By.CLASS_NAME, "nameCls").text
                price = _to_float(item.find_element(By.CLASS_NAME, "price").text)
                link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
                if not title or price is None:
                    continue

                results.append({
                    "store": "Ajio",
                    "title": title,
                    "url": urljoin("https://www.ajio.com", link),
                    "price": price,
                    "rating": 4.0,
                    "reviews": 300,
                    "position": index,
                })
            except Exception:
                continue

    finally:
        driver.quit()

    return results
