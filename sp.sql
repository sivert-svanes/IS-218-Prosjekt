CREATE OR REPLACE FUNCTION get_k_nearest_shelters(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_k INT DEFAULT 10
)
RETURNS JSON AS $$
DECLARE
    v_result JSON;
    clamp_k INT;
BEGIN
    clamp_k := LEAST(GREATEST(p_k, 1), 50);

    SELECT json_build_object(
        'type', 'FeatureCollection',
        'features', COALESCE(json_agg(
            json_build_object(
                'type', 'Feature',
                'geometry', ST_AsGeoJSON(posisjon)::json,
                'properties', to_jsonb(json_build_object(
                    'distance_km', ROUND((dist_m / 1000.0)::numeric, 2)
                )) || to_jsonb(t.*) - 'posisjon'
            ) ORDER BY dist_m
        ), '[]'::json)
    ) INTO v_result
    FROM (
        SELECT *,
            ST_Distance(posisjon, ST_SetSRID(ST_Point(p_lng, p_lat), 4326)) as dist_m
        FROM public.shelters
        ORDER BY posisjon <-> ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
        LIMIT clamp_k
    ) t;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_nvdb_roads_geojson(
    p_min_lng FLOAT8,
    p_min_lat FLOAT8,
    p_max_lng FLOAT8,
    p_max_lat FLOAT8,
    p_road_types TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(ST_Force2D(geom_4326))::json,
                    'properties', json_build_object(
                        'typeVeg', "net.typeveg"
                    )
                )
            ), '[]'::json)
        ) AS geojson
        FROM public.nvdb_roads
        WHERE ST_Intersects(
            geom_4326,
            ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
        )
        AND (p_road_types IS NULL OR "net.typeveg" = ANY(p_road_types))
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;


CREATE OR REPLACE FUNCTION get_brannstasjoner()
RETURNS JSON AS $$
BEGIN
    RETURN (
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
        ) t
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_fylke_bbox_3857(p_fylke_id INT)
RETURNS TABLE(minx FLOAT8, miny FLOAT8, maxx FLOAT8, maxy FLOAT8) AS $$
BEGIN
    RETURN QUERY
    SELECT ST_XMin(b), ST_YMin(b), ST_XMax(b), ST_YMax(b)
    FROM (SELECT ST_Envelope(ST_Transform(geomfylke, 3857)) AS b
          FROM public.fylker WHERE id = p_fylke_id) t;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_shelters_within_fylke(p_fylke_id INT)
RETURNS JSON AS $$
BEGIN
    RETURN (
        SELECT json_build_object(
            'type', 'FeatureCollection',
            'fylke_navn', (SELECT navn FROM public.fylker WHERE id = p_fylke_id),
            'features', COALESCE(json_agg(
                json_build_object(
                    'type', 'Feature',
                    'geometry', ST_AsGeoJSON(posisjon)::json,
                    'properties', to_jsonb(t.*) - 'posisjon'
                )
            ), '[]'::json)
        ) AS geojson
        FROM (
            SELECT *
            FROM public.shelters b
            WHERE ST_Within(
                b.posisjon,
                (SELECT geomfylke FROM public.fylker WHERE id = p_fylke_id)
            )
        ) t
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT;

COMMENT ON FUNCTION get_shelters_within_fylke(INT) IS
'Get all shelters within a specific fylke (county) as GeoJSON FeatureCollection.

Parameters: p_fylke_id - County ID

Returns: GeoJSON FeatureCollection with county name and shelter locations.

Example: SELECT * FROM get_shelters_within_fylke(5);';

COMMENT ON FUNCTION get_fylke_bbox_3857(INT) IS
'Get bounding box of a fylke (county) in Web Mercator projection (EPSG:3857).

Parameters: p_fylke_id - County ID

Returns: Tuple of (minx, miny, maxx, maxy) coordinates, or empty if not found.

Example: SELECT * FROM get_fylke_bbox_3857(5);';

COMMENT ON FUNCTION get_brannstasjoner() IS
'Get all fire stations as GeoJSON FeatureCollection (limited to 1000).

Returns: GeoJSON FeatureCollection with fire station locations.

Example: SELECT * FROM get_brannstasjoner();';

COMMENT ON FUNCTION get_nvdb_roads_geojson(FLOAT8, FLOAT8, FLOAT8, FLOAT8, TEXT[]) IS
'Get NVDB road segments as GeoJSON within a bounding box (WGS84).

Parameters: p_min_lng, p_min_lat, p_max_lng, p_max_lat (bounding box in EPSG:4326), p_road_types (optional filter array)

Returns: GeoJSON FeatureCollection with road segments, sorted by distance.

Example: SELECT * FROM get_nvdb_roads_geojson(8.0, 59.0, 9.0, 60.0, ARRAY[''Enkel bilveg'', ''Bilferje'']);';

COMMENT ON FUNCTION get_k_nearest_shelters(FLOAT8, FLOAT8, INT) IS
'Get k nearest shelters to given coordinates as GeoJSON FeatureCollection.

Uses PostGIS spatial index for O(log n) lookup via distance operator (<->).

Parameters: p_lat, p_lng (WGS84), p_k (default 10, max 50)

Returns: GeoJSON FeatureCollection with k nearest shelters, sorted by distance.

Example: SELECT * FROM get_k_nearest_shelters(59.5, 8.0, 10);';