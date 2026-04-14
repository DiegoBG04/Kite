"""
db.py — Database Connection Module

Purpose: Provides connection helpers for both the Supabase REST client
(used for general queries via the Supabase API) and a direct psycopg2
connection to the underlying Postgres database (required for pgvector
operations, which the REST client does not support).

Import get_supabase_client() for REST operations.
Import get_pg_conn() anywhere you need to run raw SQL with vector types.
"""

import os
import logging

import psycopg2
from supabase import create_client, Client

logger = logging.getLogger(__name__)


def get_supabase_client() -> Client:
    """
    Return an authenticated Supabase REST client.

    Uses SUPABASE_URL and SUPABASE_KEY from the environment.
    The anon key is fine for server-side use here since we control the backend.
    """
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")

    if not url or not key:
        raise EnvironmentError(
            "SUPABASE_URL and SUPABASE_KEY must be set in your .env file. "
            "Find them in Supabase Dashboard → Settings → API."
        )

    return create_client(url, key)


def get_pg_conn() -> psycopg2.extensions.connection:
    """
    Open and return a raw psycopg2 connection to the Supabase Postgres database.

    Required for pgvector operations (embedding upsert, cosine similarity search)
    because the Supabase REST client does not support the vector data type.

    The caller is responsible for closing the connection (use in a try/finally block).

    DATABASE_URL format:
        postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    Find it in: Supabase Dashboard → Settings → Database → Connection string (URI).
    """
    database_url = os.environ.get("DATABASE_URL")

    if not database_url:
        raise EnvironmentError(
            "DATABASE_URL is not set. Get it from Supabase Dashboard → "
            "Settings → Database → Connection string (URI mode)."
        )

    conn = psycopg2.connect(database_url)
    return conn
