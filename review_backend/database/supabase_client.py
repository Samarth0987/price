import os

from dotenv import load_dotenv

try:
    from supabase import Client, create_client
except ImportError:
    Client = None
    create_client = None

# Load environment variables from .env file if present.
load_dotenv()

DEFAULT_SUPABASE_URL = os.getenv("SUPABASE_URL")
DEFAULT_SUPABASE_KEY = os.getenv("SUPABASE_KEY")

SUPABASE_URL = os.getenv("SUPABASE_URL", DEFAULT_SUPABASE_URL)
SUPABASE_KEY = os.getenv("SUPABASE_KEY", DEFAULT_SUPABASE_KEY)

supabase = None

if create_client and SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    except Exception as exc:
        print(f"Supabase client init skipped: {exc}")
else:
    print("Supabase client init skipped: missing package or credentials")
