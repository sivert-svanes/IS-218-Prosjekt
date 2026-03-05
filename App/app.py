import flask
import requests as http_requests
import diskcache
import hashlib
import os
from App import app, database

DSB_WMS_BASE = 'https://ogc.dsb.no/wms.ashx'
DSB_WMS_CACHE_TTL = 60 * 60 * 24 * 7

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

@app.route('/api/dsb-wms')
def dsb_wms_proxy():
    """
    Proxy endpoint for DSB WMS tiles. Allows server-side analysis of tiles.
    Responses are cached to disk (TTL = 7 days) so repeated tile requests are
    served instantly without hitting the slow upstream WMS provider.
    """
    params = flask.request.args.to_dict(flat=False)
    flat_params = {k: v[0] if len(v) == 1 else v for k, v in params.items()}

    # Stable cache key: hash of the sorted, normalised query string
    cache_key = hashlib.sha256(
        '&'.join(f'{k}={v}' for k, v in sorted(flat_params.items())).encode()
    ).hexdigest()

    cached = tile_cache.get(cache_key)
    if cached is not None:
        content, content_type = cached
        return flask.Response(content, status=200, headers={
            'Content-Type': content_type,
            'X-Tile-Cache': 'HIT',
            'Access-Control-Allow-Origin': '*',
        })

    upstream = http_requests.get(DSB_WMS_BASE, params=flat_params, timeout=30)

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