-- Direct k-nearest neighbors function for shelters
-- Returns k nearest shelters as GeoJSON using PostGIS spatial index
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

COMMENT ON FUNCTION get_k_nearest_shelters(FLOAT8, FLOAT8, INT) IS
'Get k nearest shelters to given coordinates as GeoJSON FeatureCollection.

Uses PostGIS spatial index for O(log n) lookup via distance operator (<->).

Parameters: p_lat, p_lng (WGS84), p_k (default 10, max 50)

Returns: GeoJSON FeatureCollection with k nearest shelters, sorted by distance.

Example: SELECT * FROM get_k_nearest_shelters(59.5, 8.0, 10);';
