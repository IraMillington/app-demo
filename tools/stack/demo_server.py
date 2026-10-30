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
            item("Birria tacos (corn tortilla, beef, cheese)", 240, 0.3, calories=460, protein=30, carbs=34, fat=22, fiber=4, sugar=2, sodium=820, saturated_fat=9, cholesterol=85, calcium=180, iron=3.6, potassium=520, water=120),
            item("Consomé", 120, 0, calories=60, protein=5, carbs=3, fat=3, sodium=640, potassium=210, water=105),
        ],
        "confidence": "medium",
        "notes": "Top-down view only: two tacos visible, portion depth assumed. Consomé estimated as half a cup.",
    },
    "tacos-2": {
        "items": [
            item("Birria tacos (corn tortilla, beef, cheese)", 360, 0.5, calories=690, protein=45, carbs=51, fat=33, fiber=6, sugar=3, sodium=1230, saturated_fat=13, cholesterol=128, calcium=270, iron=5.4, potassium=780, water=180),
            item("Consomé", 120, 0, calories=60, protein=5, carbs=3, fat=3, sodium=640, potassium=210, water=105),
        ],
        "confidence": "high",
        "notes": "Both photos show the same plate. The side view shows three tacos, not two, each counted once. Consomé half a cup.",
    },
    "bowl-1": {
        "items": [
            item("Oatmeal made with 2% milk", 240, 6.0, calories=250, protein=10, carbs=38, fat=6, fiber=4, sugar=12, sodium=120, calcium=250, iron=2, magnesium=60, potassium=380, water=180),
            item("Mixed berries", 70, 0, calories=35, carbs=8, fiber=2.5, sugar=5, vitamin_c=20, potassium=80, water=60),
            item("Honey", 7, 0, calories=21, carbs=6, sugar=6),
        ],
        "confidence": "medium",
        "notes": "Top-down view: bowl depth unknown, assumed one cup of oatmeal made with milk.",
    },
    "bowl-2": {
        "items": [
            item("Oatmeal made with 2% milk", 360, 9.0, calories=375, protein=15, carbs=57, fat=9, fiber=6, sugar=18, sodium=180, calcium=375, iron=3, magnesium=90, potassium=570, water=270),
            item("Mixed berries", 70, 0, calories=35, carbs=8, fiber=2.5, sugar=5, vitamin_c=20, potassium=80, water=60),
            item("Honey", 7, 0, calories=21, carbs=6, sugar=6),
        ],
        "confidence": "high",
        "notes": "Two views of one bowl. The side view shows a deep bowl, so about 1.5 cups of oatmeal, counted once.",
    },
    "latte-1": {
        "items": [item("Oat-milk latte", 355, 0, calories=150, protein=3, carbs=22, fat=6, sugar=10, sodium=120, calcium=350, caffeine=150, potassium=330, water=320)],
        "confidence": "medium",
        "notes": "12 oz cup assumed; foam suggests oat milk from the menu board, so no lactose.",
    },
    "pasta-1": {
        "items": [
            item("Spaghetti with tomato sauce", 330, 0, calories=390, protein=13, carbs=72, fat=6, fiber=5, sugar=9, sodium=560, potassium=520, iron=3, water=210),
            item("Parmesan", 5, 0.1, calories=22, protein=2, fat=1.5, calcium=60, sodium=80),
        ],
        "confidence": "medium",
        "notes": "About 1.5 cups of cooked pasta with marinara and a spoon of parmesan.",
    },
    "salad-1": {
        "items": [
            item("Mixed greens and tomato", 150, 0, calories=45, protein=3, carbs=8, fiber=3, vitamin_a=4000, vitamin_c=25, vitamin_k=120, potassium=420, water=135),
            item("Croutons", 15, 0, calories=60, protein=2, carbs=10, fat=2, sodium=150),
            item("Ranch dressing", 30, 0.8, calories=130, protein=0.5, carbs=2, fat=13, sodium=270, saturated_fat=2),
        ],
        "confidence": "medium",
        "notes": "Dressing assumed 2 tbsp of ranch.",
    },
    "toast-1": {
        "items": [
            item("Sourdough toast", 45, 0, calories=120, protein=4, carbs=23, fat=1, fiber=1, sodium=230),
            item("Avocado", 50, 0, calories=80, protein=1, carbs=4, fat=7, fiber=3, potassium=240),
            item("Fried egg", 50, 0, calories=90, protein=6, fat=7, cholesterol=185, sodium=95),
        ],
        "confidence": "high",
        "notes": "One slice of toast with a third of an avocado and a fried egg.",
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
