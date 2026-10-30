"""Makes the demo camera roll (demo-photos/*.jpg) from the Wikimedia Commons
photos credited in demo-photos/CREDITS.md. Needs Pillow. Run from tools/."""
import io
import urllib.parse
import time
import urllib.error
import urllib.request

from PIL import Image, ImageOps

UA = {"User-Agent": "app-demo-photo-maker/1.0 (https://iramillington.github.io/app-demo/)"}
SOURCES = {
    "tacos": "Tacos_de_Barba_Birria_6.jpg",
    "bowl": "Oatmeal,_blueberries_and_almond_milk.jpg",
    "latte": "Caffe_Latte_cup.jpg",
    "pasta": "Tomato_sauce_spaghetti,_at_Restaurant_Gusto_(2013.07.13)_2.jpg",
    "salad": "Salad_bowl_at_Bröd_&_Salt.jpg",
    "toast": "Smashed_Avocado_On_Toast_(with_one_poached_egg)_-_Jonny's_2026-01-06.jpg",
}
# photo: (source, crop box as fractions x0, y0, x1, y1, or None for the whole photo)
PHOTOS = {
    "tacos": ("tacos", (0.10, 0.00, 0.62, 0.50)),
    "tacosSide": ("tacos", None),
    "bowl": ("bowl", (0.12, 0.18, 0.62, 0.80)),
    "bowlSide": ("bowl", None),
    "latte": ("latte", None),
    "pasta": ("pasta", None),
    "salad": ("salad", None),
    "toast": ("toast", None),
}


def fetch(name):
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=1280"
    for _ in range(6):
        try:
            return Image.open(io.BytesIO(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()))
        except urllib.error.HTTPError as e:
            if e.code != 429:
                raise
            time.sleep(int(e.headers.get("retry-after", "20")) + 2)
    raise SystemExit(f"could not fetch {name}")


images = {k: ImageOps.exif_transpose(fetch(v)).convert("RGB") for k, v in SOURCES.items()}
for name, (src, box) in PHOTOS.items():
    im = images[src]
    if box:
        w, h = im.size
        im = im.crop((int(box[0] * w), int(box[1] * h), int(box[2] * w), int(box[3] * h)))
    ImageOps.fit(im, (1200, 900), Image.LANCZOS).save(f"demo-photos/{name}.jpg", quality=82, optimize=True)
