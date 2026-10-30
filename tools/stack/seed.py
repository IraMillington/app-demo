"""Fills the throwaway demo database with invented people and three weeks of history,
using only the health server's own public API (the same calls the app makes)."""
import json
import random
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

import requests

BASE = "http://127.0.0.1:8080"
HERE = Path(__file__).parent
TODAY = date.fromisoformat(sys.argv[1]) if len(sys.argv) > 1 else date.today()
DAYS = 21
rng = random.Random(7)


def call(token, method, path, body=None):
    r = requests.request(method, BASE + path, json=body, headers={"Authorization": f"Bearer {token}"}, timeout=120)
    if r.status_code >= 400:
        print("FAIL", method, path, r.status_code, r.text[:200])
        return None
    return r.json()


def account(username, display, setup):
    r = requests.post(BASE + "/api/accounts/signup", json={"username": username, "password": "demo-pass-123", "display_name": display, "setup": setup}, timeout=60)
    if r.status_code >= 400:
        r = requests.post(BASE + "/api/accounts/login", json={"username": username, "password": "demo-pass-123"}, timeout=60)
    return r.json()["token"]


FOOD_CACHE = HERE / "food_cache.json"
foods = json.loads(FOOD_CACHE.read_text()) if FOOD_CACHE.exists() else {}


def food(token, query):
    if query not in foods:
        res = call(token, "GET", f"/api/foods/search?q={requests.utils.quote(query)}&page=1") or {"results": []}
        pick = next((f for f in res["results"] if f["source"] == "fdc"), None) or (res["results"] or [None])[0]
        if not pick:
            raise SystemExit(f"no food for {query}")
        foods[query] = {"source": pick["source"], "id": pick["id"], "name": pick["name"]}
        FOOD_CACHE.write_text(json.dumps(foods, indent=1))
    return foods[query]


def log(token, query, meal, d, grams):
    f = food(token, query)
    return call(token, "POST", "/api/diary", {"source": f["source"], "source_id": f["id"], "meal": meal, "date": d.isoformat(), "grams": grams, "serving_qty": grams, "serving_unit": "g"})


MENUS = {
    "Breakfast": [
        [("plain greek yogurt", 170), ("granola", 40), ("blueberries raw", 70)],
        [("oatmeal cooked", 240), ("banana raw", 118), ("milk 2%", 120)],
        [("egg scrambled", 120), ("whole wheat bread toasted", 60), ("avocado raw", 50)],
    ],
    "Lunch": [
        [("chicken breast grilled", 140), ("brown rice cooked", 180), ("black beans cooked", 90)],
        [("turkey sandwich", 220), ("apple raw", 180)],
        [("lentil soup", 350), ("whole wheat bread toasted", 40)],
    ],
    "Dinner": [
        [("salmon baked", 150), ("sweet potato baked", 150), ("broccoli cooked", 90)],
        [("spaghetti cooked", 220), ("marinara sauce", 125), ("parmesan cheese grated", 15)],
        [("cheese pizza", 220), ("ice cream vanilla", 90)],
        [("beef tacos", 240), ("cheddar cheese", 28)],
    ],
    "Snacks": [[("almonds", 28)], [("apple raw", 180)], [("string cheese mozzarella", 28)]],
}

def history(token, profile, heavy=True):
    for back in range(DAYS, -1, -1):
        d = TODAY - timedelta(days=back)
        is_today = back == 0
        steps = rng.randint(5200, 12800)
        call(token, "POST", "/api/health", {"date": d.isoformat(), "steps": steps, "active_energy": int(steps * 0.045 + rng.randint(40, 120)), "basal_energy": rng.randint(1420, 1480), "stand_hours": rng.randint(8, 13), **({"weight": round(158 - (DAYS - back) * 0.18 + rng.uniform(-0.6, 0.6), 1)} if heavy and back % 2 == 0 else {})})
        hours = rng.uniform(6.2, 8.4)
        end = datetime(d.year, d.month, d.day, 6, rng.randint(30, 59), tzinfo=timezone(timedelta(hours=-5)))
        start = end - timedelta(hours=hours + 0.4)
        call(token, "POST", "/api/sleep", {"date": d.isoformat(), "sleep": round(hours, 2), "deep": round(hours * 0.16, 2), "core": round(hours * 0.56, 2), "rem": round(hours * 0.24, 2), "awake": 0.4, "sleep_pct": round(hours / 7 * 100), "sleep_start": start.isoformat(), "sleep_end": end.isoformat(), "source": "Apple Watch"})
        if not heavy:
            continue
        if is_today:
            break
        for meal, options in MENUS.items():
            if meal == "Snacks" and rng.random() < 0.4:
                continue
            if meal == "Breakfast" and back in (6, 13):
                call(token, "POST", "/api/meal-checkin", {"meal": "Breakfast", "date": d.isoformat(), "status": "skipped"})
                continue
            menu = rng.choice(options)
            for q, g in menu:
                log(token, q, meal, d, g)
        for _ in range(rng.randint(5, 9)):
            call(token, "POST", "/api/water", {"ml": 240, "date": d.isoformat()})
        call(token, "POST", "/api/journal", {"date": d.isoformat(), "stress": rng.randint(1, 4), "mood": rng.randint(3, 5), "overall": rng.randint(2, 5)})


def habits(token, defs):
    created = []
    for name, sched, tod, public in defs:
        body = {"name": name, "time_of_day": tod, "public": public, "practice": None, **sched}
        h = call(token, "POST", "/api/habits", body)
        if h:
            created.append(h)
    for back in range(DAYS, 0, -1):
        d = TODAY - timedelta(days=back)
        for h in created:
            if rng.random() < 0.75:
                call(token, "POST", "/api/habits/toggle", {"habit_id": h["id"], "completed": True, "date": d.isoformat()})
    return created


def main():
    sam = account("sam", "Sam", {"sex": "female", "birth_year": 1995, "height_cm": 168, "track_weight": True, "leaderboard": True, "wearable": "healthkit", "goals": ["lose_weight", "build_muscle", "build_habits"], "weight_lb": 158, "goal_weight_lb": 148, "goal_date": (TODAY + timedelta(days=120)).isoformat()})
    others = [
        ("jordan", "Jordan", {"sex": "male", "birth_year": 1991, "height_cm": 180, "leaderboard": True, "wearable": "healthkit", "goals": ["move_more", "build_habits"]}),
        ("priya", "Priya", {"sex": "female", "birth_year": 1998, "height_cm": 160, "leaderboard": True, "wearable": "google_health", "goals": ["sleep_better", "build_habits"]}),
        ("alex", "Alex", {"sex": "male", "birth_year": 1989, "height_cm": 175, "leaderboard": True, "wearable": "healthkit", "goals": ["build_muscle", "build_habits"]}),
    ]
    history(sam, "sam", heavy=True)
    habits(sam, [
        ("Stretch 10 minutes", {"weekdays": ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]}, "morning", True),
        ("Vitamin D", {"cadence_days": 1}, "morning", False),
        ("Walk after dinner", {"cadence_days": 1}, "evening", True),
        ("Meal prep", {"weekdays": ["sun"]}, "afternoon", False),
        ("Change water filter", {"cadence_days": 30}, "anytime", False),
    ])
    for user, name, setup in others:
        t = account(user, name, setup)
        history(t, user, heavy=False)
        habits(t, [("Read 20 pages", {"cadence_days": 1}, "evening", True), ("No phone after 11", {"weekdays": ["mon", "tue", "wed", "thu", "fri"]}, "evening", True)])
    # Today, part-way through: breakfast and lunch logged, dinner open.
    d = TODAY
    for q, g in [("plain greek yogurt", 170), ("granola", 40), ("blueberries raw", 70)]:
        log(sam, q, "Breakfast", d, g)
    for q, g in [("chicken breast grilled", 140), ("brown rice cooked", 180), ("black beans cooked", 90)]:
        log(sam, q, "Lunch", d, g)
    for _ in range(4):
        call(sam, "POST", "/api/water", {"ml": 240, "date": d.isoformat()})
    print("seeded; foods:", len(foods))


if __name__ == "__main__":
    main()
