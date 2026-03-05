import flask
import requests as http_requests
import diskcache
import hashlib
import os
import threading
from collections import OrderedDict
from App import app, database

DSB_WMS_CACHE_TTL = 60 * 60 * 24 * 7

# Allowlist of upstream base URLs that the proxy is permitted to forward to.
PROXY_ALLOWED_URLS = {
    'https://ogc.dsb.no/wms.ashx',
    'https://wms.geonorge.no/skwms1/wms.norges_grunnkart',
}

_cache_dir = os.path.join(os.path.dirname(__file__), '.tile_cache')
# FanoutCache shards across 8 sub-caches, reducing SQLite lock contention
# when multiple tiles are requested concurrently.
tile_cache = diskcache.FanoutCache(_cache_dir, shards=8, size_limit=2 ** 30)

# In-memory LRU cache sitting in front of the disk cache.
# At ~40 KB avg per tile, 4096 entries ≈ 160 MB — covers a large browsed area.
_MEM_CACHE_MAX = 4096
_mem_cache: OrderedDict[str, tuple[bytes, str]] = OrderedDict()
_mem_lock = threading.Lock()   # OrderedDict is not thread-safe on its own

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

@app.route('/api/wms-proxy')
def wms_proxy():
    """
    Generic WMS proxy endpoint. Pass the upstream base URL via the `url`
    query parameter; all other query parameters are forwarded as-is.
    """
    params = flask.request.args.to_dict(flat=False)
    flat_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}

    upstream_url = flat_params.pop('url', None)
    if not upstream_url:
        return flask.Response('Missing required "url" parameter', status=400)
    if upstream_url not in PROXY_ALLOWED_URLS:
        return flask.Response(f'URL not in allowlist: {upstream_url}', status=403)

    # Stable cache key: hash of the upstream URL + sorted, normalised query string
    cache_key = hashlib.sha256(
        (upstream_url + '&' + '&'.join(f'{k}={v}' for k, v in sorted(flat_params.items()))).encode()
    ).hexdigest()

    # 1. Memory cache (no disk I/O)
    mem_hit = _mem_get(cache_key)
    if mem_hit is not None:
        content, content_type = mem_hit
        return flask.Response(content, status=200, headers={
            'Content-Type': content_type,
            'X-Tile-Cache': 'MEM-HIT',
            'Access-Control-Allow-Origin': '*',
        })

    # 2. Disk cache (persistent across restarts)
    cached = tile_cache.get(cache_key)
    if cached is not None:
        content, content_type = cached
        _mem_set(cache_key, (content, content_type))   # promote to memory
        return flask.Response(content, status=200, headers={
            'Content-Type': content_type,
            'X-Tile-Cache': 'DISK-HIT',
            'Access-Control-Allow-Origin': '*',
        })

    # 3. Upstream fetch
    upstream = http_requests.get(upstream_url, params=flat_params, timeout=30)

    excluded_headers = {'content-encoding', 'transfer-encoding', 'connection'}
    headers = {
        k: v for k, v in upstream.headers.items()
        if k.lower() not in excluded_headers
    }
    headers['Access-Control-Allow-Origin'] = '*'
    headers['X-Tile-Cache'] = 'MISS'

    if upstream.status_code == 200:
        content_type = upstream.headers.get('Content-Type', 'image/png')
        tile_cache.set(cache_key, (upstream.content, content_type), expire=DSB_WMS_CACHE_TTL)
        _mem_set(cache_key, (upstream.content, content_type))

    return flask.Response(upstream.content, status=upstream.status_code, headers=headers)