import os
import sqlalchemy
from sqlalchemy import text
from dotenv import load_dotenv

load_dotenv()
CONN_STR = os.getenv("DATABASE_URL")


def create_engine():
    if not CONN_STR:
        raise ValueError("DATABASE_URL mangler i .env / environment.")
    return sqlalchemy.create_engine(CONN_STR, future=True)


def database_test_query(engine):
    with engine.connect() as conn:
        result = conn.execute(text("SELECT * FROM pg_catalog.pg_tables;"))
        print(result.all())


def get_brannstasjoner(engine):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(geom)::json,
                        'properties', to_jsonb(t.*) - 'geom'
                    )
                ), '[]'::json)
            ) AS geojson
            FROM (
                SELECT *
                FROM public.brannstasjoner
                LIMIT 1000
            ) t;
        """))
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}
