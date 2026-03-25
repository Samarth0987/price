from bs4 import BeautifulSoup
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

def search_flipkart_selenium(query):
    driver = get_driver()
    results = []

    try:
        url = f"https://www.flipkart.com/search?q={query.replace(' ', '%20')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-id]"))
        )
        soup = BeautifulSoup(driver.page_source, "html.parser")
        items = soup.select("div[data-id]")

        for index, item in enumerate(items, start=1):
            title_node = item.select_one("a.atJtCj")
            price_node = item.select_one("div.hZ3P6w")
            rating_node = item.select_one("div.XQDdHH")

            title = title_node.get_text(strip=True) if title_node else ""
            url = urljoin("https://www.flipkart.com", title_node.get("href")) if title_node else None
            price = _to_float(price_node.get_text(strip=True) if price_node else "")
            if not title or price is None:
                continue

            results.append({
                "store": "Flipkart",
                "title": title,
                "url": url,
                "price": price,
                "rating": float(rating_node.get_text(strip=True)) if rating_node else 4.0,
                "reviews": 1000,
                "position": index,
            })

            if len(results) == MAX_RESULTS:
                break

    finally:
        driver.quit()

    return results
