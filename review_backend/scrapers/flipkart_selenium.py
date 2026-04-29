from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import os
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
        raw_value.replace("₹", "")
        .replace(",", "")
        .strip()
    )
    try:
        return float(cleaned)
    except ValueError:
        return None


def _collect_results_from_soup(soup):
    results = []
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

    return results


def _search_flipkart_http(query):
    response = requests.get(
        "https://www.flipkart.com/search",
        params={"q": query},
        headers=HTTP_HEADERS,
        timeout=20,
    )
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    return _collect_results_from_soup(soup)

def search_flipkart_selenium(query):
    try:
        http_results = _search_flipkart_http(query)
        if http_results:
            return http_results
    except Exception as error:
        print("⚠️ Flipkart HTTP fallback failed:", error)

    driver = get_driver()
    try:
        url = f"https://www.flipkart.com/search?q={query.replace(' ', '%20')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-id]"))
        )
        soup = BeautifulSoup(driver.page_source, "html.parser")
        results = _collect_results_from_soup(soup)

    finally:
        driver.quit()

    return results
