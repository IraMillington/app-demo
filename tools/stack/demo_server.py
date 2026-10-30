"""Runs the real health server for recording the demo, with two substitutions:

- The AI photo/description model is replaced by canned answers (the recorder
  names which one in next_estimate.json before each estimate). Everything the
  server does with the model's answer (normalizing, totals, lactose, storing)
  is the real code.
- Nothing else: database, accounts, reports and leaderboard are the real code
  against a throwaway Postgres + PostgREST holding only invented data.
"""
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).parent
sys.path.insert(0, os.getcwd())

import config  # noqa: E402
import requests  # noqa: E402
import vision  # noqa: E402
from nutrition import NUTRIENT_KEYS  # noqa: E402

config.OPENROUTER_API_KEY = "demo-canned"

# per-item: name, grams, lactose_g, {nutrient: value}
def item(name, grams, lactose, **n):
    base = {k: 0.0 for k in NUTRIENT_KEYS}
    base.update(n)
    out = {"name": name, "estimated_grams": grams, "nutrients": base}
    if lactose:
        out["contains_lactose"] = True
        out["lactose_grams"] = lactose
    return out


CANNED = {
    "tacos-1": {
        "items": [
            item("Birria tacos (corn tortilla, beef, pickled onion, cilantro)", 240, 0, calories=430, protein=28, carbs=34, fat=20, fiber=4, sugar=3, sodium=760, saturated_fat=7, cholesterol=75, calcium=90, iron=3.4, potassium=500, water=120),
        ],
        "confidence": "low",
        "notes": "Close-up: one taco in full and the edges of others, so the count is a guess; two assumed.",
    },
    "tacos-2": {
        "items": [
            item("Birria tacos (corn tortilla, beef, pickled onion, cilantro)", 360, 0, calories=645, protein=42, carbs=51, fat=30, fiber=6, sugar=4, sodium=1140, saturated_fat=10.5, cholesterol=112, calcium=135, iron=5.1, potassium=750, water=180),
        ],
        "confidence": "high",
        "notes": "Both photos show the same plate. The whole-plate photo shows three tacos, and the close-up's taco is one of them, so three in all, each counted once.",
    },
    "bowl-1": {
        "items": [
            item("Oatmeal made with almond milk", 240, 0, calories=200, protein=6, carbs=32, fat=5, fiber=4, sugar=1, sodium=150, calcium=200, iron=2, magnesium=60, potassium=200, water=200),
            item("Blueberries", 40, 0, calories=23, carbs=6, fiber=1, sugar=4, vitamin_c=4, potassium=30, water=34),
            item("Walnuts", 15, 0, calories=98, protein=2.3, carbs=2, fat=9.8, fiber=1, magnesium=24, potassium=66),
        ],
        "confidence": "medium",
        "notes": "Close-up: the bowl's size is not visible, so one cup of oatmeal is assumed.",
    },
    "bowl-2": {
        "items": [
            item("Oatmeal made with almond milk", 360, 0, calories=300, protein=9, carbs=48, fat=7.5, fiber=6, sugar=1.5, sodium=225, calcium=300, iron=3, magnesium=90, potassium=300, water=300),
            item("Blueberries", 40, 0, calories=23, carbs=6, fiber=1, sugar=4, vitamin_c=4, potassium=30, water=34),
            item("Walnuts", 15, 0, calories=98, protein=2.3, carbs=2, fat=9.8, fiber=1, magnesium=24, potassium=66),
        ],
        "confidence": "high",
        "notes": "Two views of one bowl. Next to the spoon the bowl is large, so about 1.5 cups of oatmeal, counted once.",
    },
    "latte-1": {
        "items": [item("Latte with whole milk", 355, 14, calories=180, protein=10, carbs=15, fat=9, sugar=14, sodium=140, calcium=380, caffeine=130, potassium=450, water=320)],
        "confidence": "medium",
        "notes": "12 oz cup and whole milk assumed.",
    },
    "pasta-1": {
        "items": [
            item("Spaghetti with tomato sauce", 330, 0, calories=390, protein=13, carbs=72, fat=6, fiber=5, sugar=9, sodium=560, potassium=520, iron=3, water=210),
            item("Parmesan", 5, 0.1, calories=22, protein=2, fat=1.5, calcium=60, sodium=80),
        ],
        "confidence": "medium",
        "notes": "About 1.5 cups of cooked spaghetti with tomato sauce and a spoon of parmesan.",
    },
    "salad-1": {
        "items": [
            item("Chicken breast with curry sauce", 120, 0, calories=200, protein=30, carbs=4, fat=7, sodium=420, potassium=350, water=80),
            item("Green olives", 30, 0, calories=44, fat=4.5, sodium=470),
            item("Peanuts", 20, 0, calories=115, protein=5, carbs=3, fat=10, fiber=2, magnesium=34, potassium=130),
            item("Greens, red cabbage and peppers", 100, 0, calories=30, protein=1.5, carbs=6, fiber=2.5, vitamin_a=2500, vitamin_c=60, vitamin_k=60, potassium=300, water=90),
        ],
        "confidence": "medium",
        "notes": "Curry sauce estimated at 2 tbsp and counted with the chicken.",
    },
    "toast-1": {
        "items": [
            item("Sourdough toast", 70, 0, calories=190, protein=7, carbs=36, fat=1.5, fiber=2, sodium=360),
            item("Smashed avocado", 70, 0, calories=112, protein=1.4, carbs=6, fat=10, fiber=5, potassium=340),
            item("Poached egg", 50, 0, calories=72, protein=6.3, fat=4.8, cholesterol=186, sodium=70),
        ],
        "confidence": "high",
        "notes": "One large slice of sourdough with about half an avocado, a poached egg and microgreens.",
    },
}

for value in CANNED.values():
    totals = {k: 0.0 for k in NUTRIENT_KEYS}
    for it in value["items"]:
        for k in NUTRIENT_KEYS:
            totals[k] += it["nutrients"][k]
    value["total_nutrients"] = totals

_real_post = requests.post


class _Canned:
    status_code = 200
    text = ""

    def __init__(self, payload):
        self._payload = payload

    def raise_for_status(self):
        return None

    def json(self):
        return {"choices": [{"finish_reason": "stop", "message": {"content": json.dumps(self._payload)}}]}


def _post(url, *args, **kwargs):
    if url == vision.OPENROUTER_URL:
        try:
            key = json.loads((HERE / "next_estimate.json").read_text())["key"]
        except Exception:
            key = "toast-1"
        parts = [CANNED[k] for k in key.split("+")]
        if len(parts) == 1:
            return _Canned(parts[0])
        # Photos of different meals: the model is told they are one meal, so it
        # merges them into one estimate with every distinct food counted once.
        merged = {"items": [it for p in parts for it in p["items"]], "confidence": "low",
                  "notes": "These photos look like different meals; they were read as one meal as instructed, each food counted once. Estimate separate meals one at a time."}
        totals = {k: 0.0 for k in NUTRIENT_KEYS}
        for it in merged["items"]:
            for k in NUTRIENT_KEYS:
                totals[k] += it["nutrients"][k]
        merged["total_nutrients"] = totals
        return _Canned(merged)
    # Any other outbound AI call stays off in the demo.
    if "openrouter.ai" in str(url):
        raise requests.ConnectionError("demo: AI calls are off")
    return _real_post(url, *args, **kwargs)


vision.requests.post = _post

import uvicorn  # noqa: E402

(HERE / "server.pid").write_text(str(os.getpid()))
uvicorn.run("server:app", host="127.0.0.1", port=8080, log_level="info")
