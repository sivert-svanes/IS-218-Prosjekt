CREATE OR REPLACE FUNCTION build_geojson_feature(
    p_geometry JSON,
    p_properties JSONB
)
RETURNS JSON AS $$
    SELECT json_build_object(
        'type', 'Feature',
        'geometry', p_geometry,
        'properties', p_properties
    );
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION build_geojson_collection(
    p_features JSON,
    p_metadata JSON DEFAULT NULL
)
RETURNS JSON AS $$
    SELECT (
        to_jsonb(json_build_object(
            'type', 'FeatureCollection',
            'features', COALESCE(p_features, '[]'::json)
        )) || COALESCE(to_jsonb(p_metadata), '{}'::jsonb)
    )::json;
$$ LANGUAGE sql IMMUTABLE;

CREATE OR REPLACE FUNCTION get_k_nearest_shelters(
    p_lat FLOAT8,
    p_lng FLOAT8,
    p_k INT DEFAULT 10
)
RETURNS JSON AS $$
    SELECT build_geojson_collection(
        COALESCE(
            json_agg(
                build_geojson_feature(
                    ST_AsGeoJSON(posisjon)::json,
                    to_jsonb(json_build_object(
                        'distance_km', ROUND((dist_m / 1000.0)::numeric, 2)
                    )) || to_jsonb(t.*) - 'posisjon'
                ) ORDER BY dist_m
            ),
            '[]'::json
        )
    )
    FROM (
        SELECT *,
            ST_Distance(posisjon, ST_SetSRID(ST_Point(p_lng, p_lat), 4326)) as dist_m
        FROM public.shelters
        ORDER BY posisjon <-> ST_SetSRID(ST_Point(p_lng, p_lat), 4326)
        LIMIT LEAST(GREATEST(p_k, 1), 50)
    ) t;
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_nvdb_roads_geojson(
    p_min_lng FLOAT8,
    p_min_lat FLOAT8,
    p_max_lng FLOAT8,
    p_max_lat FLOAT8,
    p_road_types TEXT[] DEFAULT NULL
)
RETURNS JSON AS $$
    SELECT build_geojson_collection(
        COALESCE(
            json_agg(
                build_geojson_feature(
                    ST_AsGeoJSON(ST_Force2D(geom_4326))::json,
                    json_build_object('typeVeg', "net.typeveg")::jsonb
                )
            ),
            '[]'::json
        )
    )
    FROM public.nvdb_roads
    WHERE ST_Intersects(
        geom_4326,
        ST_MakeEnvelope(p_min_lng, p_min_lat, p_max_lng, p_max_lat, 4326)
    )
    AND (p_road_types IS NULL OR "net.typeveg" = ANY(p_road_types));
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_brannstasjoner()
RETURNS JSON AS $$
    SELECT build_geojson_collection(
        COALESCE(
            json_agg(
                build_geojson_feature(
                    ST_AsGeoJSON(geom)::json,
                    to_jsonb(t.*) - 'geom'
                )
            ),
            '[]'::json
        )
    )
    FROM (
        SELECT *
        FROM public.brannstasjoner
        LIMIT 1000
    ) t;
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_fylke_bbox_3857(p_fylke_id INT)
RETURNS TABLE(minx FLOAT8, miny FLOAT8, maxx FLOAT8, maxy FLOAT8) AS $$
    SELECT ST_XMin(b), ST_YMin(b), ST_XMax(b), ST_YMax(b)
    FROM (SELECT ST_Envelope(ST_Transform(geomfylke, 3857)) AS b
          FROM public.fylker WHERE id = p_fylke_id) t;
$$ LANGUAGE sql IMMUTABLE STRICT;

CREATE OR REPLACE FUNCTION get_shelters_within_fylke(p_fylke_id INT)
RETURNS JSON AS $$
    SELECT build_geojson_collection(
        COALESCE(
            json_agg(
                build_geojson_feature(
                    ST_AsGeoJSON(posisjon)::json,
                    to_jsonb(t.*) - 'posisjon'
                ) ORDER BY t.fid
            ),
            '[]'::json
        ),
        json_build_object('fylke_namn', (SELECT navn FROM public.fylker WHERE id = p_fylke_id))
    )
    FROM (
        SELECT *
        FROM public.shelters b
        WHERE ST_Within(
            b.posisjon,
            (SELECT geomfylke FROM public.fylker WHERE id = p_fylke_id)
        )
    ) t;
$$ LANGUAGE sql IMMUTABLE STRICT;

COMMENT ON FUNCTION build_geojson_feature(JSON, JSONB) IS
'Build a GeoJSON Feature object.';

COMMENT ON FUNCTION build_geojson_collection(JSON, JSON) IS
'Build a GeoJSON FeatureCollection with optional metadata.';

COMMENT ON FUNCTION get_k_nearest_shelters(FLOAT8, FLOAT8, INT) IS
'Get k nearest shelters (WGS84 EPSG:4326). Uses PostGIS spatial index for O(log n) lookup.';

COMMENT ON FUNCTION get_nvdb_roads_geojson(FLOAT8, FLOAT8, FLOAT8, FLOAT8, TEXT[]) IS
'Get NVDB road segments within bounding box (WGS84 EPSG:4326).';

COMMENT ON FUNCTION get_brannstasjoner() IS
'Get all fire stations (limited to 1000).';

COMMENT ON FUNCTION get_fylke_bbox_3857(INT) IS
'Get county bounding box in Web Mercator (EPSG:3857).';

COMMENT ON FUNCTION get_shelters_within_fylke(INT) IS
'Get shelters within a specific county.';