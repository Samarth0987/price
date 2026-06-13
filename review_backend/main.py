from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import concurrent.futures
import os
import re
import time

# 🛒 Scrapers
from scrapers.amazon_selenium import search_amazon_selenium
from scrapers.flipkart_selenium import search_flipkart_selenium
from scrapers.myntra_selenium import search_myntra_selenium
from scrapers.ajio_selenium import search_ajio_selenium

# 💾 Database
from services.db_service import save_products

# ---------------- MODELS ----------------

SUPPORTED_STORES = ["Amazon", "Flipkart", "Myntra", "Ajio"]
QUERY_CACHE = {}
CACHE_TTL_SECONDS = int(os.getenv("QUERY_CACHE_TTL_SECONDS", "300"))
STOP_WORDS = {
    "a", "an", "and", "are", "at", "buy", "by", "for", "from", "in", "of",
    "on", "or", "the", "to", "with",
}
GENERIC_PRODUCT_TOKENS = {
    "analog", "analogue", "black", "blue", "boys", "brown", "casual",
    "digital", "dial", "edition", "gold", "green", "grey", "men", "modern",
    "pack", "pink", "quartz", "rose", "silver", "smart", "smartwatch",
    "sports", "steel", "stainless", "strap", "style", "toned", "unisex",
    "watch", "watches", "white", "women", "wrist", "youth",
}
PHONE_QUERY_TOKENS = {
    "iphone", "mobile", "phone", "phones", "smartphone", "smartphones",
    "samsung", "galaxy", "pixel", "oneplus", "redmi", "realme", "oppo",
    "vivo", "nothing",
}
PHONE_ACCESSORY_TOKENS = {
    "adapter", "back", "cable", "case", "charger", "charging", "connector",
    "cover", "finewoven", "glass", "guard", "holder", "lightning", "magsafe",
    "protector", "safe", "screen", "skin", "tempered", "type", "wallet",
}
IPHONE_VARIANT_TOKENS = {"air", "e", "max", "mini", "plus", "pro", "se"}
STORAGE_TOKENS = {"gb", "tb"}

class Offer(BaseModel):
    store: str
    price: Optional[float] = None
    currency: str = "₹"
    rating: Optional[float] = None
    reviewCount: Optional[int] = None
    title: Optional[str] = None
    url: Optional[str] = None
    sentiment: str
    available: bool = True


class Product(BaseModel):
    product_id: int
    name: str
    offers: List[Offer]


class ReviewResponse(BaseModel):
    query: str
    products: List[Product]


# ---------------- BUSINESS LOGIC ----------------

def classify_sentiment(rating: float, review_count: int) -> str:
    if rating >= 4.2 and review_count >= 100:
        return "Good"
    if rating >= 3.5:
        return "Medium"
    return "Bad"


def build_unavailable_offer(store: str) -> Offer:
    return Offer(
        store=store,
        price=None,
        rating=None,
        reviewCount=None,
        title=None,
        url=None,
        sentiment="Unavailable",
        available=False,
    )


def tokenize(text: str) -> List[str]:
    return [token for token in re.findall(r"[a-z0-9]+", (text or "").lower()) if token not in STOP_WORDS]


def informative_tokens(text: str) -> List[str]:
    tokens = tokenize(text)
    filtered = [
        token for token in tokens
        if token not in GENERIC_PRODUCT_TOKENS and (len(token) > 2 or any(ch.isdigit() for ch in token))
    ]
    if filtered:
        return filtered
    longer_tokens = [token for token in tokens if len(token) > 2]
    return longer_tokens or tokens


def has_phone_query_intent(query: str) -> bool:
    return bool(set(tokenize(query)) & PHONE_QUERY_TOKENS)


def has_strong_product_intent(query: str) -> bool:
    return is_specific_query(query) or has_phone_query_intent(query)


def is_likely_phone_accessory(title: str) -> bool:
    return bool(set(tokenize(title)) & PHONE_ACCESSORY_TOKENS)


def item_matches_query_intent(query: str, item: dict) -> bool:
    title = item.get("title", "")
    title_tokens = set(tokenize(title))
    query_tokens = set(tokenize(query))

    if not query_tokens:
        return True

    if has_phone_query_intent(query):
        if is_likely_phone_accessory(title):
            return False
        return bool(title_tokens & (query_tokens | PHONE_QUERY_TOKENS))

    return True


def filter_results_for_query_intent(query: str, results: List[dict]) -> List[dict]:
    filtered = [item for item in results if item_matches_query_intent(query, item)]
    removed_count = len(results) - len(filtered)
    if removed_count:
        print(f"🧹 Filtered {removed_count} off-intent/accessory results for '{query}'")
    return filtered


def extract_iphone_signature(title: str) -> Optional[dict]:
    tokens = tokenize(title)
    if "iphone" not in tokens:
        return None

    iphone_index = tokens.index("iphone")
    generation = None
    variants = set()
    storage = None

    for offset, token in enumerate(tokens[iphone_index + 1:], start=iphone_index + 1):
        if token in STORAGE_TOKENS:
            if offset > 0 and re.fullmatch(r"\d+", tokens[offset - 1]):
                storage = f"{tokens[offset - 1]}{token}"
            break
        if re.fullmatch(r"\d+(?:[a-z])?", token):
            generation = re.match(r"\d+", token).group(0)
            suffix = token[len(generation):]
            if suffix:
                variants.add(suffix)
            continue
        if token in IPHONE_VARIANT_TOKENS:
            if generation is None and token in {"air", "se"}:
                generation = token
            variants.add(token)
            continue
        if generation is not None:
            break

    return {
        "brand": "iphone",
        "generation": generation,
        "variants": variants,
        "storage": storage,
    }


def product_identity_key(item: dict) -> str:
    iphone_signature = extract_iphone_signature(item.get("title", ""))
    if iphone_signature:
        variants = "-".join(sorted(iphone_signature["variants"])) or "base"
        generation = iphone_signature["generation"] or "unknown"
        storage = iphone_signature["storage"] or "unknown"
        return f"iphone::{generation}::{variants}::{storage}"

    return "tokens::" + "::".join(sorted(set(informative_tokens(item.get("title", "")))))


def dedupe_results_for_query(query: str, results: List[dict]) -> List[dict]:
    if not has_strong_product_intent(query):
        return results

    best_by_store_and_identity = {}
    for item in results:
        key = (item.get("store"), product_identity_key(item))
        existing = best_by_store_and_identity.get(key)
        if not existing:
            best_by_store_and_identity[key] = item
            continue

        item_rank = (
            query_match_score(query, item),
            -float(item.get("price", 0) or 0),
            -int(item.get("position", 999) or 999),
        )
        existing_rank = (
            query_match_score(query, existing),
            -float(existing.get("price", 0) or 0),
            -int(existing.get("position", 999) or 999),
        )
        if item_rank > existing_rank:
            best_by_store_and_identity[key] = item

    deduped = list(best_by_store_and_identity.values())
    removed_count = len(results) - len(deduped)
    if removed_count:
        print(f"🧽 Deduped {removed_count} repeated variants for '{query}'")
    return deduped


def product_signatures_compatible(anchor: dict, item: dict) -> bool:
    anchor_iphone = extract_iphone_signature(anchor.get("title", ""))
    item_iphone = extract_iphone_signature(item.get("title", ""))

    if not anchor_iphone or not item_iphone:
        return True

    anchor_generation = anchor_iphone["generation"]
    item_generation = item_iphone["generation"]
    if anchor_generation and item_generation and anchor_generation != item_generation:
        return False

    anchor_storage = anchor_iphone["storage"]
    item_storage = item_iphone["storage"]
    if anchor_storage and item_storage and anchor_storage != item_storage:
        return False

    anchor_variants = anchor_iphone["variants"]
    item_variants = item_iphone["variants"]
    if anchor_variants and item_variants and anchor_variants != item_variants:
        return False

    return True


def jaccard_similarity(left_tokens: List[str], right_tokens: List[str]) -> float:
    left = set(left_tokens)
    right = set(right_tokens)
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def model_token_overlap(left_tokens: List[str], right_tokens: List[str]) -> float:
    left = {token for token in left_tokens if any(ch.isdigit() for ch in token) or len(token) >= 5}
    right = {token for token in right_tokens if any(ch.isdigit() for ch in token) or len(token) >= 5}
    if not left or not right:
        return 0.0
    return len(left & right) / max(len(left), len(right))


def query_match_score(query: str, item: dict) -> float:
    query_tokens = informative_tokens(query)
    title_tokens = informative_tokens(item.get("title", ""))
    base = jaccard_similarity(query_tokens, title_tokens)
    model_bonus = 0.5 * model_token_overlap(query_tokens, title_tokens)
    substring_bonus = 0.25 if query.strip().lower() in item.get("title", "").lower() else 0.0
    position = int(item.get("position", 99) or 99)
    position_bonus = max(0.0, (6 - position) * 0.07)
    return base + model_bonus + substring_bonus + position_bonus


def pair_match_score(anchor: dict, item: dict) -> float:
    anchor_tokens = informative_tokens(anchor.get("title", ""))
    item_tokens = informative_tokens(item.get("title", ""))
    base = jaccard_similarity(anchor_tokens, item_tokens)
    model_bonus = 0.6 * model_token_overlap(anchor_tokens, item_tokens)
    brand_bonus = 0.0
    anchor_title_tokens = tokenize(anchor.get("title", ""))
    item_title_tokens = tokenize(item.get("title", ""))
    if anchor_title_tokens and item_title_tokens and anchor_title_tokens[0] == item_title_tokens[0]:
        brand_bonus = 0.15
    return base + model_bonus + brand_bonus


def is_specific_query(query: str) -> bool:
    tokens = informative_tokens(query)
    return len(tokens) >= 2 or any(any(ch.isdigit() for ch in token) for token in tokens)


def item_key(item: dict) -> str:
    return item.get("url") or f"{item.get('store')}::{item.get('title')}::{item.get('position')}"


def combined_match_score(query: str, anchor: dict, item: dict) -> float:
    if not item_matches_query_intent(query, item):
        return 0.0
    if not product_signatures_compatible(anchor, item):
        return 0.0
    return (0.65 * pair_match_score(anchor, item)) + (0.35 * query_match_score(query, item))


def choose_anchor_item(query: str, results_by_store: dict, available_keys: Optional[set] = None) -> Optional[dict]:
    all_items = [item for items in results_by_store.values() for item in items]
    if not all_items:
        return None

    best_anchor = None
    best_score = -1.0

    for candidate in all_items:
        if available_keys is not None and item_key(candidate) not in available_keys:
            continue
        coverage = 1
        score = query_match_score(query, candidate)

        for store, items in results_by_store.items():
            if store == candidate.get("store"):
                continue
            store_candidates = [
                item for item in items
                if available_keys is None or item_key(item) in available_keys
            ]
            if not store_candidates:
                continue
            best_store_score = max(combined_match_score(query, candidate, item) for item in store_candidates)
            if best_store_score >= 0.2:
                coverage += 1
                score += best_store_score

        candidate_score = (coverage * 10) + score
        if candidate_score > best_score:
            best_score = candidate_score
            best_anchor = candidate

    return best_anchor


def build_results_by_store(results: List[dict]) -> dict:
    results_by_store = {store: [] for store in SUPPORTED_STORES}
    for item in results:
        store = item.get("store")
        if store in results_by_store:
            results_by_store[store].append(item)

    return results_by_store


def select_best_matches(query: str, results: List[dict]) -> dict:
    results = filter_results_for_query_intent(query, results)
    results = dedupe_results_for_query(query, results)
    results_by_store = build_results_by_store(results)
    if not any(results_by_store.values()):
        return {}

    if not has_strong_product_intent(query):
        selected = {}
        for store, items in results_by_store.items():
            if not items:
                continue
            selected[store] = max(
                items,
                key=lambda item: (query_match_score(query, item), -int(item.get("position", 99) or 99)),
            )
        return selected

    anchor = choose_anchor_item(query, results_by_store)
    if not anchor:
        return {}

    selected = {}
    for store, items in results_by_store.items():
        if not items:
            continue

        if store == anchor.get("store"):
            selected[store] = anchor
            continue

        best_item = max(
            items,
            key=lambda item: combined_match_score(query, anchor, item),
        )
        best_score = combined_match_score(query, anchor, best_item)
        if best_score >= 0.2:
            selected[store] = best_item

    return selected


def build_product_name(query: str, group_items: List[dict], anchor: Optional[dict]) -> str:
    if anchor and anchor.get("title"):
        return anchor["title"]

    titles = [item.get("title") for item in group_items if item.get("title")]
    if not titles:
        return query

    if has_strong_product_intent(query):
        return max(titles, key=len)

    return max(titles, key=lambda title: query_match_score(query, {"title": title, "position": 1}))


def build_product_groups(query: str, results: List[dict]) -> List[Product]:
    results = filter_results_for_query_intent(query, results)
    results = dedupe_results_for_query(query, results)
    results_by_store = build_results_by_store(results)
    if not any(results_by_store.values()):
        return []

    if not has_strong_product_intent(query):
        ordered_results = {
            store: sorted(
                items,
                key=lambda item: int(item.get("position", 999) or 999),
            )
            for store, items in results_by_store.items()
        }
        max_groups = int(os.getenv("MAX_PRODUCT_GROUPS", "12"))
        available_group_count = max((len(items) for items in ordered_results.values()), default=0)
        groups = []

        for group_index in range(min(max_groups, available_group_count)):
            group_by_store = {}
            for store in SUPPORTED_STORES:
                store_items = ordered_results.get(store, [])
                if group_index < len(store_items):
                    group_by_store[store] = store_items[group_index]

            if not group_by_store:
                continue

            group_items = list(group_by_store.values())
            anchor = max(
                group_items,
                key=lambda item: (
                    query_match_score(query, item),
                    -int(item.get("position", 999) or 999),
                ),
            )
            offers = [
                build_offer(group_by_store[store]) if store in group_by_store else build_unavailable_offer(store)
                for store in SUPPORTED_STORES
            ]
            groups.append(
                Product(
                    product_id=group_index + 1,
                    name=build_product_name(query, group_items, anchor),
                    offers=offers,
                )
            )

        return groups

    available_keys = {
        item_key(item)
        for items in results_by_store.values()
        for item in items
    }
    groups = []
    max_groups = int(os.getenv("MAX_PRODUCT_GROUPS", "12"))
    match_threshold = 0.2 if has_strong_product_intent(query) else 0.12
    product_id = 1

    while available_keys and len(groups) < max_groups:
        anchor = choose_anchor_item(query, results_by_store, available_keys)
        if not anchor:
            break

        group_by_store = {anchor["store"]: anchor}
        available_keys.discard(item_key(anchor))

        for store in SUPPORTED_STORES:
            if store == anchor.get("store"):
                continue

            candidates = [
                item for item in results_by_store.get(store, [])
                if item_key(item) in available_keys
            ]
            if not candidates:
                continue

            best_item = max(candidates, key=lambda item: combined_match_score(query, anchor, item))
            if combined_match_score(query, anchor, best_item) >= match_threshold:
                group_by_store[store] = best_item
                available_keys.discard(item_key(best_item))

        group_items = list(group_by_store.values())
        offers = [
            build_offer(group_by_store[store]) if store in group_by_store else build_unavailable_offer(store)
            for store in SUPPORTED_STORES
        ]
        groups.append(
            Product(
                product_id=product_id,
                name=build_product_name(query, group_items, anchor),
                offers=offers,
            )
        )
        product_id += 1

    return groups


def build_offer(item: dict) -> Offer:
    rating = float(item.get("rating", 0) or 0)
    review_count = int(item.get("reviews", 0) or 0)
    return Offer(
        store=item.get("store", ""),
        price=float(item["price"]),
        rating=rating,
        reviewCount=review_count,
        title=item.get("title"),
        url=item.get("url"),
        sentiment=classify_sentiment(rating, review_count),
        available=True,
    )


def has_live_offers(products: List[Product]) -> bool:
    return any(
        offer.available and offer.price is not None
        for product in products
        for offer in product.offers
    )


def has_full_store_coverage(products: List[Product]) -> bool:
    covered_stores = {
        offer.store
        for product in products
        for offer in product.offers
        if offer.available and offer.price is not None
    }
    return all(store in covered_stores for store in SUPPORTED_STORES)


def build_product_offers(query: str, results: List[dict]) -> List[Product]:
    products = build_product_groups(query, results)
    available_offers = [
        offer
        for product in products
        for offer in product.offers
        if offer.available and offer.price is not None
    ]

    if available_offers:
        best_offer = min(available_offers, key=lambda offer: offer.price)
        print(f"🔥 Best Deal: {best_offer.store} - ₹{best_offer.price}")
        return products

    print(f"⚠️ No live offers found for '{query}'")
    return [
        Product(
            product_id=1,
            name=query,
            offers=[build_unavailable_offer(store) for store in SUPPORTED_STORES],
        )
    ]


def fetch_reviews_from_sites(query: str):
    normalized_query = query.strip().lower()
    cached_entry = QUERY_CACHE.get(normalized_query)
    if (
        cached_entry
        and time.time() - cached_entry["timestamp"] < CACHE_TTL_SECONDS
        and has_full_store_coverage(cached_entry["products"])
    ):
        return cached_entry["products"]

    results = []
    scrape_timeout = float(os.getenv("SCRAPE_TIMEOUT_SECONDS", "28"))
    # Too many concurrent headless browsers make non-Amazon stores flaky.
    executor = concurrent.futures.ThreadPoolExecutor(max_workers=3)
    futures = [
        executor.submit(search_amazon_selenium, query),
        executor.submit(search_ajio_selenium, query),
        executor.submit(search_flipkart_selenium, query),
        executor.submit(search_myntra_selenium, query),
    ]

    # 🚀 Parallel scraping with a cap so one stuck scraper doesn't block the API forever.
    done, not_done = concurrent.futures.wait(
        futures,
        timeout=scrape_timeout,
        return_when=concurrent.futures.ALL_COMPLETED,
    )

    for future in done:
        try:
            results.extend(future.result())
        except Exception as e:
            print("❌ Scraper error:", e)

    for future in not_done:
        future.cancel()

    if not_done:
        print(f"⚠️ Scraper timeout after {scrape_timeout}s, using partial/fallback results")

    executor.shutdown(wait=False, cancel_futures=True)
    store_counts = {
        store: sum(1 for item in results if item.get("store") == store)
        for store in SUPPORTED_STORES
    }
    print(f"🧾 Scraper counts for '{query}': {store_counts}")

    # 💾 Save data to Supabase
    if results:
        try:
            save_products(query, results)
        except Exception as e:
            print("❌ Database error:", e)

    products = build_product_offers(query, results)
    if has_full_store_coverage(products):
        QUERY_CACHE[normalized_query] = {
            "timestamp": time.time(),
            "products": products,
        }
    else:
        QUERY_CACHE.pop(normalized_query, None)
    return products


# ---------------- FASTAPI SETUP ----------------

app = FastAPI(title="Price Lens API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------- ROUTES ----------------

@app.get("/")
def root():
    return {"message": "Price Lens Backend Running 🚀"}


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/reviews", response_model=ReviewResponse)
def get_reviews(query: str = Query(...)):
    products = fetch_reviews_from_sites(query)
    return ReviewResponse(query=query, products=products)
