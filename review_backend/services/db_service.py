from database.supabase_client import supabase
from datetime import datetime

def save_products(query: str, items: list):
    """
    Save scraped product data into Supabase
    """

    if not items:
        print("No data to save")
        return

    data = []

    for item in items:
        try:
            data.append({
                "query": query,
                "store": item.get("store"),
                "title": item.get("title"),
                "price": float(item.get("price", 0)),
                "rating": float(item.get("rating", 0)),
                "reviews": int(item.get("reviews", 0)),
                "created_at": datetime.utcnow().isoformat()
            })
        except Exception as e:
            print("Error formatting item:", e)

    if not supabase:
        print("Supabase client unavailable, skipping database save")
        return

    try:
        response = supabase.table("products").insert(data).execute()
        print("✅ Data inserted successfully")
        return response
    except Exception as e:
        print("❌ Database insert error:", e)
