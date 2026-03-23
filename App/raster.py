import math
import io
import hashlib
import time
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor

import numpy as np
import requests
from PIL import Image
from App.app import tile_cache, _mem_get, _mem_set, DSB_WMS_CACHE_TTL

#UNUSED, SWITCHED TO DIFF APPROACH FOR ROUTING, KEPT AS IT COULD BE USEFUL FOR OTHER STUFF

_FKB_WMS_URL = "https://wms.geonorge.no/skwms1/wms.fkb"
_R = 6_378_137.0
_WMS_SCALE_M_PX = 10_000 * 0.00028  # metres per pixel at 1:10 000


def _to_3857(lng: float, lat: float) -> tuple[float, float]:
    x = math.radians(lng) * _R
    y = math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)) * _R
    return x, y


def _cache_key(wms_url: str, params: dict) -> str:
    return hashlib.sha256(
        (wms_url + "&" + "&".join(f"{k}={v}" for k, v in sorted(params.items()))).encode()
    ).hexdigest()


def _decode(content: bytes, output_px: int) -> np.ndarray:
    """PNG bytes → RGBA uint8 ndarray of shape (output_px, output_px, 4)."""
    img = Image.open(io.BytesIO(content)).convert("RGBA")
    if img.size[0] != output_px:
        img = img.resize((output_px, output_px), Image.Resampling.BOX)
    return np.asarray(img)   # zero-copy view of PIL buffer


@dataclass
class RasterTile:
    data: np.ndarray                               # shape (px, px, 4) RGBA uint8
    bbox_3857: tuple[float, float, float, float]   # (minx, miny, maxx, maxy)
    col: int
    row: int


@dataclass
class FKBVeiTileSet:
    tiles: list[RasterTile] = field(default_factory=list)
    center_3857: tuple[float, float] = (0.0, 0.0)
    resolution_m_per_px: float = 0.0
    grid_cols: int = 0
    grid_rows: int = 0
    crs: str = "EPSG:3857"


def fetch_fkb_vei_tiles(
    lat: float,
    lng: float,
    *,
    tile_size_m: float = 900,
    output_px: int = 128,
    grid: tuple[int, int] = (3, 3),
    proxy_base_url: str = "http://localhost:5000",
    timeout: int = 30,
    wms_url: str = _FKB_WMS_URL,
) -> FKBVeiTileSet:
    """
    Fetch FKB Vei raster tiles centred on (lat, lng) through the app proxy.

    tile_size_m : Ground coverage per tile in metres (default 900 m).
    output_px   : Output tile size in pixels (default 128).
    grid        : (cols, rows) tile grid around the centre (default 3×3).
    """
    wms_px = min(int(tile_size_m / _WMS_SCALE_M_PX), 512)
    cx, cy = _to_3857(lng, lat)
    cols, rows = grid
    origin_x = cx - (cols / 2) * tile_size_m
    origin_y = cy + (rows / 2) * tile_size_m
    proxy_url = f"{proxy_base_url.rstrip('/')}/api/wms-proxy"

    def fetch_tile(col_idx: int, row_idx: int) -> RasterTile:
        minx = origin_x + col_idx * tile_size_m
        maxx = minx + tile_size_m
        maxy = origin_y - row_idx * tile_size_m
        miny = maxy - tile_size_m

        params = {
            "SERVICE": "WMS", "VERSION": "1.3.0", "REQUEST": "GetMap",
            "LAYERS": "veg", "STYLES": "", "CRS": "EPSG:3857",
            "BBOX": f"{minx},{miny},{maxx},{maxy}",
            "WIDTH": wms_px, "HEIGHT": wms_px,
            "FORMAT": "image/png", "TRANSPARENT": "TRUE",
        }
        key = _cache_key(wms_url, params)

        t0 = time.perf_counter()
        hit = _mem_get(key) or tile_cache.get(key)
        if hit:
            content, label = hit[0], "MEM/DISK"
            _mem_set(key, hit)
        else:
            resp = requests.get(proxy_url, timeout=timeout, params={"url": wms_url, **params})
            resp.raise_for_status()
            hit = (resp.content, resp.headers.get("Content-Type", "image/png"))
            _mem_set(key, hit)
            tile_cache.set(key, hit, DSB_WMS_CACHE_TTL)
            content, label = hit[0], "NET"
        t1 = time.perf_counter()

        data = _decode(content, output_px)
        t2 = time.perf_counter()
        print(f"  tile ({col_idx},{row_idx}) [{label}]  fetch: {t1-t0:.3f}s  decode+resize: {t2-t1:.3f}s")
        return RasterTile(data, (minx, miny, maxx, maxy), col_idx, row_idx)

    coords = [(c, r) for r in range(rows) for c in range(cols)]
    with ThreadPoolExecutor(max_workers=len(coords)) as pool:
        futures = [pool.submit(fetch_tile, c, r) for c, r in coords]
        tiles = [f.result() for f in futures]

    return FKBVeiTileSet(
        tiles=tiles,
        center_3857=(cx, cy),
        resolution_m_per_px=tile_size_m / output_px,
        grid_cols=cols,
        grid_rows=rows,
    )

def stitch_and_show(tileset: FKBVeiTileSet) -> np.ndarray:
    """Stitch all tiles into one numpy canvas and display via matplotlib. No disk I/O."""
    import matplotlib.pyplot as plt

    cols, rows = tileset.grid_cols, tileset.grid_rows
    px = tileset.tiles[0].data.shape[0]

    t0 = time.perf_counter()
    canvas = np.empty((rows * px, cols * px, 4), dtype=np.uint8)
    for tile in tileset.tiles:
        r, c = tile.row, tile.col
        canvas[r*px:(r+1)*px, c*px:(c+1)*px] = tile.data
    t1 = time.perf_counter()
    print(f"  stitch : {t1 - t0:.3f}s")

    fig, ax = plt.subplots(figsize=(8, 8))
    ax.imshow(canvas)
    ax.set_title(f"FKB Vei  |  {cols}×{rows} tiles  |  {tileset.resolution_m_per_px:.1f} m/px")
    for c in range(1, cols):
        ax.axvline(c * px - 0.5, color="red", linewidth=0.5, alpha=0.4)
    for r in range(1, rows):
        ax.axhline(r * px - 0.5, color="red", linewidth=0.5, alpha=0.4)
    ax.axis("off")
    plt.tight_layout()
    plt.show()
    t2 = time.perf_counter()
    print(f"  render : {t2 - t1:.3f}s")
    return canvas


if __name__ == "__main__":

    TEST_LAT, TEST_LNG = 58.1599, 8.0182
    print(f"Fetching FKB Vei tiles centred on ({TEST_LAT}, {TEST_LNG}) ...")

    t0 = time.perf_counter()
    ts = fetch_fkb_vei_tiles(TEST_LAT, TEST_LNG)
    t1 = time.perf_counter()
    print(f"  fetch : {t1 - t0:.2f}s  |  {len(ts.tiles)} tiles  |  {ts.resolution_m_per_px:.2f} m/px")

    stitch_and_show(ts)
    t2 = time.perf_counter()
    print(f"  stitch+show : {t2 - t1:.2f}s")
    print(f"  total       : {t2 - t0:.2f}s")
