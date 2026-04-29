from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import os
import re
import requests
from urllib.parse import urljoin
from utils.driver import get_driver

MAX_RESULTS = int(os.getenv("SCRAPER_RESULTS_PER_STORE", "8"))
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-IN,en;q=0.9",
}


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


def _extract_myntra_state(html):
    soup = BeautifulSoup(html, "html.parser")
    for script in soup.find_all("script"):
        text = script.string or script.get_text()
        if not text or "window.__myx =" not in text:
            continue
        match = re.search(r"window\.__myx\s*=\s*(\{.*\})\s*;?\s*$", text, re.S)
        if match:
            return json.loads(match.group(1))
    raise ValueError("Unable to locate Myntra search state")


def _collect_results_from_products(products):
    results = []

    for index, product in enumerate(products, start=1):
        price = product.get("discountedPrice") or product.get("price")
        title = product.get("product") or product.get("productName")
        if not title or price is None:
            continue

        results.append({
            "store": "Myntra",
            "title": title,
            "url": urljoin("https://www.myntra.com/", product.get("landingPageUrl", "")),
            "price": float(price),
            "rating": float(product.get("rating") or 4.0),
            "reviews": int(product.get("ratingCount") or 500),
            "position": index,
        })

        if len(results) == MAX_RESULTS:
            break

    return results


def _search_myntra_http(query):
    response = requests.get(
        f"https://www.myntra.com/{query.replace(' ', '-')}",
        headers=HTTP_HEADERS,
        timeout=20,
    )
    response.raise_for_status()
    state = _extract_myntra_state(response.text)
    products = state.get("searchData", {}).get("results", {}).get("products", [])
    return _collect_results_from_products(products)

def search_myntra_selenium(query):
    try:
        http_results = _search_myntra_http(query)
        if http_results:
            return http_results
    except Exception as error:
        print("⚠️ Myntra HTTP fallback failed:", error)

    driver = get_driver()
    results = []

    try:
        # Myntra search URL
        url = f"https://www.myntra.com/{query.replace(' ', '-')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "li.product-base"))
        )

        state = _extract_myntra_state(driver.page_source)
        products = state.get("searchData", {}).get("results", {}).get("products", [])
        results = _collect_results_from_products(products)

    finally:
        driver.quit()

    return results
