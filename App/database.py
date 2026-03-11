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

def get_fylke_bbox_3857(engine, fylke_id):
    """Return (minx, miny, maxx, maxy) in EPSG:3857 for a county."""
    with engine.connect() as conn:
        row = conn.execute(text("""
            SELECT ST_XMin(b), ST_YMin(b), ST_XMax(b), ST_YMax(b)
            FROM (SELECT ST_Envelope(ST_Transform(geomfylke, 3857)) AS b
                  FROM public.fylker WHERE id = :id) t
        """), {"id": fylke_id}).fetchone()
        return tuple(row) if row else None


def get_shelters_within_fylke(engine, fylke_id):
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT json_build_object(
                'type', 'FeatureCollection',
                'fylke_navn', (SELECT navn FROM public.fylker WHERE id = :fylke_id),
                'features', COALESCE(json_agg(
                    json_build_object(
                        'type', 'Feature',
                        'geometry', ST_AsGeoJSON(posisjon)::json,
                        'properties', to_jsonb(t.*) - 'geom'
                    )
                ), '[]'::json)
            ) AS geojson
            FROM (
                SELECT *
                FROM public.shelters b
                WHERE ST_Within(
                    b.posisjon,
                    (SELECT geomfylke FROM public.fylker WHERE id = :fylke_id)
                )) t;
        """), {"fylke_id": fylke_id})
        row = result.fetchone()
        return row[0] if row else {"type": "FeatureCollection", "features": []}