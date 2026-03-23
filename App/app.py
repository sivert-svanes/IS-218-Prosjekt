import flask
import requests as http_requests
import diskcache
import hashlib
import os
import threading
from collections import OrderedDict
from concurrent.futures import ThreadPoolExecutor
from App import app, database

DSB_WMS_CACHE_TTL = 60 * 60 * 24 * 7

# Allowlist of upstream base URLs that the proxy is permitted to forward to.
PROXY_ALLOWED_URLS = {
    'https://ogc.dsb.no/wms.ashx',
    'https://wms.geonorge.no/skwms1/wms.norges_grunnkart',
    'https://wms.geonorge.no/skwms1/wms.fkb',
}

_cache_dir = os.path.join(os.path.dirname(__file__), '.tile_cache')
# FanoutCache shards across 8 sub-caches, reducing SQLite lock contention
# when multiple tiles are requested concurrently.
tile_cache = diskcache.FanoutCache(_cache_dir, shards=8, size_limit=2 ** 33)

_MEM_CACHE_MAX = 4096
_mem_cache: OrderedDict[str, tuple[bytes, str]] = OrderedDict()
_mem_lock = threading.Lock()
_executor = ThreadPoolExecutor(max_workers=8)
_in_flight: dict[str, threading.Event] = {}
_in_flight_lock = threading.Lock()

_county_bboxes: dict[int, tuple] = {}
_county_bbox_lock = threading.Lock()
_county_bbox_ready: dict[int, threading.Event] = {}

# 1×1 transparent PNG for tiles skipped by county filter
_TRANSPARENT_PNG = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01'
    b'\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01'
    b'\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)

def _get_county_bbox(fylke_id: int):
    """Return the cached bbox, waiting up to 10 s for the background load to finish."""
    event = _county_bbox_ready.get(fylke_id)
    if event:
        event.wait(timeout=10)
    with _county_bbox_lock:
        return _county_bboxes.get(fylke_id)

def _load_county_bbox(fylke_id: int):
    try:
        bbox = database.get_fylke_bbox_3857(database.create_engine(), fylke_id)
        if bbox:
            with _county_bbox_lock:
                _county_bboxes[fylke_id] = bbox
    except Exception as e:
        print(f'Warning: could not load bbox for fylke {fylke_id}: {e}')
    finally:
        _county_bbox_ready[fylke_id].set()

_county_bbox_ready[5] = threading.Event()
_executor.submit(_load_county_bbox, 5)

def _mem_get(key: str):
    with _mem_lock:
        if key not in _mem_cache:
            return None
        _mem_cache.move_to_end(key)
        return _mem_cache[key]

def _mem_set(key: str, value: tuple[bytes, str]):
    with _mem_lock:
        if key in _mem_cache:
            _mem_cache.move_to_end(key)
        else:
            if len(_mem_cache) >= _MEM_CACHE_MAX:
                _mem_cache.popitem(last=False)
        _mem_cache[key] = value


@app.route('/')
def hello_world():
    return flask.render_template('index.html')

@app.route('/api/brannstasjoner')
def api_brannstasjoner():
    engine = database.create_engine()
    geojson = database.get_brannstasjoner(engine)
    return flask.jsonify(geojson)

@app.route('/api/fylke/<int:fylke_id>')
def api_fylke(fylke_id):
    engine = database.create_engine()
    geojson = database.get_shelters_within_fylke(engine, fylke_id)
    return flask.jsonify(geojson)

@app.route('/api/nvdb/roads')
def api_nvdb_roads():
    """Fetch NVDB road segments as GeoJSON from PostGIS."""
    min_x = flask.request.args.get('min_x', type=float)
    min_y = flask.request.args.get('min_y', type=float)
    max_x = flask.request.args.get('max_x', type=float)
    max_y = flask.request.args.get('max_y', type=float)

    if not all([min_x, min_y, max_x, max_y]):
        return flask.jsonify({"type": "FeatureCollection", "features": []})

    try:
        engine = database.create_engine()
        geojson = database.get_nvdb_as_geojson(engine, min_x, min_y, max_x, max_y)
        feature_count = len(geojson.get('features', []))
        print(f"NVDB API: bbox=({min_x}, {min_y}, {max_x}, {max_y}), features={feature_count}")
        return flask.jsonify(geojson)
    except Exception as e:
        print(f"Error fetching NVDB roads: {e}")
        import traceback
        traceback.print_exc()
        return flask.jsonify({"type": "FeatureCollection", "features": []})

def _tile_response(hit, label):
    return flask.Response(hit[0], status=200, content_type=hit[1],
                          headers={'X-Tile-Cache': label, 'Access-Control-Allow-Origin': '*'})

@app.route('/api/wms-proxy')
@app.route('/api/wms-proxy/<int:fylke_id>')
def wms_proxy(fylke_id: int = None):
    """Generic WMS proxy — pass upstream URL via `url` param, rest forwarded as-is.
    Optional fylke_id path segment clips tiles to that county's bounding box.
    Cache tiers: memory LRU → disk (FanoutCache) → upstream (deduplicated)."""
    flat_params = dict(flask.request.args)

    upstream_url = flat_params.pop('url', None)
    if not upstream_url:
        return flask.Response('Missing "url" parameter', status=400)
    if upstream_url not in PROXY_ALLOWED_URLS:
        return flask.Response('URL not in allowlist', status=403)

    if fylke_id is not None:
        bbox_str = flat_params.get('BBOX') or flat_params.get('bbox', '')
        county = _get_county_bbox(fylke_id)
        if county and bbox_str:
            t = [float(v) for v in bbox_str.split(',')]
            if t[2] < county[0] or t[0] > county[2] or t[3] < county[1] or t[1] > county[3]:
                return flask.Response(_TRANSPARENT_PNG, status=200, content_type='image/png',
                                      headers={'Access-Control-Allow-Origin': '*'})

    cache_key = hashlib.sha256(
        (upstream_url + '&' + '&'.join(f'{k}={v}' for k, v in sorted(flat_params.items()))).encode()
    ).hexdigest()

    hit = _mem_get(cache_key)
    if hit: return _tile_response(hit, 'MEM-HIT')

    hit = tile_cache.get(cache_key)
    if hit:
        _mem_set(cache_key, hit)
        return _tile_response(hit, 'DISK-HIT')

    # Deduplicate concurrent upstream fetches for the same tile
    with _in_flight_lock:
        is_leader = cache_key not in _in_flight
        if is_leader:
            _in_flight[cache_key] = threading.Event()
        event = _in_flight[cache_key]

    if not is_leader:
        event.wait(timeout=35)
        hit = _mem_get(cache_key) or tile_cache.get(cache_key)
        return _tile_response(hit, 'DEDUP-HIT') if hit else flask.Response('Upstream failed', status=502)

    try:
        resp = http_requests.get(upstream_url, params=flat_params, timeout=30)
        content_type = resp.headers.get('Content-Type', 'image/png')
        if resp.status_code == 200:
            hit = (resp.content, content_type)
            _mem_set(cache_key, hit)
            _executor.submit(tile_cache.set, cache_key, hit, DSB_WMS_CACHE_TTL)
        return flask.Response(resp.content, status=resp.status_code, content_type=content_type,
                              headers={'X-Tile-Cache': 'MISS', 'Access-Control-Allow-Origin': '*'})
    finally:
        with _in_flight_lock:
            _in_flight.pop(cache_key, None)
        event.set()