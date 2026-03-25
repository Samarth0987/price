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


def _to_rating(raw_value):
    if not raw_value:
        return 4.0
    try:
        return float(raw_value.split(" ")[0])
    except (ValueError, IndexError):
        return 4.0


def _to_reviews(raw_value):
    if not raw_value:
        return 0
    digits = "".join(ch for ch in raw_value if ch.isdigit())
    return int(digits) if digits else 0


def _extract_title(item):
    candidates = [
        node.get_text(strip=True)
        for node in item.select(
            "a.a-link-normal.s-line-clamp-2.a-text-normal span, "
            "a.a-link-normal.s-line-clamp-2 span, "
            "h2.a-size-base-plus span, "
            "h2.a-size-mini span"
        )
    ]
    candidates = [title for title in candidates if title]
    return max(candidates, key=len) if candidates else ""


def _extract_url(item):
    candidates = item.select(
        "a.a-link-normal.s-line-clamp-2.a-text-normal, a.a-link-normal.s-line-clamp-2"
    )
    best_link = None
    best_length = -1

    for link in candidates:
        href = link.get("href")
        text_length = len(link.get_text(strip=True))
        if href and text_length > best_length:
            best_link = href
            best_length = text_length

    return urljoin("https://www.amazon.in", best_link) if best_link else None


def search_amazon_selenium(query):
    driver = get_driver()
    results = []

    try:
        url = f"https://www.amazon.in/s?k={query.replace(' ', '+')}"
        driver.get(url)
        WebDriverWait(driver, 12).until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "div[data-component-type='s-search-result']")
            )
        )
        soup = BeautifulSoup(driver.page_source, "html.parser")
        items = soup.select("div[data-component-type='s-search-result']")

        for index, item in enumerate(items, start=1):
            price_node = item.select_one(".a-price .a-offscreen")
            rating_node = item.select_one("span.a-icon-alt")
            review_node = item.select_one("span.a-size-base.s-underline-text")

            title = _extract_title(item)
            url = _extract_url(item)
            price = _to_float(price_node.get_text(strip=True) if price_node else "")
            if not title or price is None:
                continue

            results.append({
                "store": "Amazon",
                "title": title,
                "url": url,
                "price": price,
                "rating": _to_rating(rating_node.get_text(strip=True) if rating_node else ""),
                "reviews": _to_reviews(review_node.get_text(strip=True) if review_node else ""),
                "position": index,
            })

            if len(results) == MAX_RESULTS:
                break

    finally:
        driver.quit()

    return results
