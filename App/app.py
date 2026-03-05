import flask
import requests as http_requests
import diskcache
import hashlib
import os
from App import app, database

DSB_WMS_CACHE_TTL = 60 * 60 * 24 * 7

# Allowlist of upstream base URLs that the proxy is permitted to forward to.
PROXY_ALLOWED_URLS = {
    'https://ogc.dsb.no/wms.ashx',
    'https://wms.geonorge.no/skwms1/wms.norges_grunnkart',
}

_cache_dir = os.path.join(os.path.dirname(__file__), '.tile_cache')
tile_cache = diskcache.Cache(_cache_dir, size_limit=2 ** 30)  # 1 GB max

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

    cached = tile_cache.get(cache_key)
    if cached is not None:
        content, content_type = cached
        return flask.Response(content, status=200, headers={
            'Content-Type': content_type,
            'X-Tile-Cache': 'HIT',
            'Access-Control-Allow-Origin': '*',
        })

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

    return flask.Response(upstream.content, status=upstream.status_code, headers=headers)