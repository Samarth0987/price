from bs4 import BeautifulSoup
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
import json
import os
import requests
from urllib.parse import urljoin
from utils.driver import get_driver

MAX_RESULTS = int(os.getenv("SCRAPER_RESULTS_PER_STORE", "8"))
HTTP_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 "
        "Mobile/15E148 Safari/604.1"
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


def _to_review_count(raw_value):
    if raw_value in (None, ""):
        return 300
    if isinstance(raw_value, (int, float)):
        return int(raw_value)

    text = str(raw_value).strip().upper()
    multiplier = 1
    if text.endswith("K"):
        multiplier = 1000
        text = text[:-1]
    elif text.endswith("M"):
        multiplier = 1000000
        text = text[:-1]

    try:
        return int(float(text) * multiplier)
    except ValueError:
        digits = "".join(ch for ch in text if ch.isdigit())
        return int(digits) if digits else 300


def _parse_ajio_state(html):
    soup = BeautifulSoup(html, "html.parser")
    prefix = "window.__PRELOADED_STATE__ = "

    for script in soup.find_all("script"):
        text = script.string or script.get_text()
        if prefix not in text:
            continue

        start = text.index(prefix) + len(prefix)
        end = text.rfind(";")
        if end <= start:
            continue
        return json.loads(text[start:end])

    raise ValueError("Unable to locate Ajio preloaded state")


def _collect_results_from_state(state):
    grid = state.get("grid", {})
    entities = grid.get("entities", {})
    results = []

    for index, entity_id in enumerate(grid.get("results", []), start=1):
        item = entities.get(entity_id, {})
        title = item.get("name")
        price = (
            item.get("offerPrice", {}).get("value")
            or item.get("price", {}).get("value")
        )
        if not title or price is None:
            continue

        results.append({
            "store": "Ajio",
            "title": title,
            "url": urljoin("https://www.ajio.com", item.get("url", "")),
            "price": float(price),
            "rating": float(item.get("rating") or 4.0),
            "reviews": _to_review_count(item.get("ratingCount")),
            "position": index,
        })

        if len(results) == MAX_RESULTS:
            break

    return results


def _search_ajio_http(query):
    response = requests.get(
        "https://www.ajio.com/search/",
        params={"text": query},
        headers=HTTP_HEADERS,
        timeout=20,
    )
    response.raise_for_status()
    state = _parse_ajio_state(response.text)
    return _collect_results_from_state(state)

def search_ajio_selenium(query):
    try:
        http_results = _search_ajio_http(query)
        if http_results:
            return http_results
    except Exception as error:
        print("⚠️ Ajio HTTP fallback failed:", error)

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

        state = _parse_ajio_state(driver.page_source)
        results = _collect_results_from_state(state)

    finally:
        driver.quit()

    return results
