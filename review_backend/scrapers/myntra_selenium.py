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
        raw_value.replace("Rs. ", "")
        .replace("₹", "")
        .replace(",", "")
        .strip()
    )
    try:
        return float(cleaned)
    except ValueError:
        return None

def search_myntra_selenium(query):
    driver = get_driver()
    results = []

    try:
        # Myntra search URL
        url = f"https://www.myntra.com/{query.replace(' ', '-')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "li.product-base"))
        )

        items = driver.find_elements(By.CSS_SELECTOR, "li.product-base")

        for index, item in enumerate(items[:MAX_RESULTS], start=1):
            try:
                brand = item.find_element(By.CLASS_NAME, "product-brand").text
                name = item.find_element(By.CLASS_NAME, "product-product").text
                price_nodes = item.find_elements(By.CLASS_NAME, "product-discountedPrice")
                if not price_nodes:
                    price_nodes = item.find_elements(By.CLASS_NAME, "product-price")
                price = _to_float(price_nodes[0].text if price_nodes else "")
                link = item.find_element(By.TAG_NAME, "a").get_attribute("href")
                if price is None:
                    continue

                title = f"{brand} {name}"

                results.append({
                    "store": "Myntra",
                    "title": title,
                    "url": urljoin("https://www.myntra.com/", link),
                    "price": price,
                    "rating": 4.0,
                    "reviews": 500,
                    "position": index,
                })
            except Exception:
                continue

    finally:
        driver.quit()

    return results
