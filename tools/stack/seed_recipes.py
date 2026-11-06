"""Fills the throwaway Recipes database: the health demo people sign in (the same
one login the app uses), become friends, and share a few recipes whose
ingredients are already matched to health-app foods. Run after seed.py.

Matches are kept in recipe_foods.json (ingredient query -> food) so a rebuild
without a USDA key reuses them; their detail rows go into food_cache_rows.json.
"""
import json
import re
from pathlib import Path

import requests

HEALTH = "http://127.0.0.1:8080"
RECIPES = "http://127.0.0.1:8092"
HERE = Path(__file__).parent
KEY = {"X-API-Key": "demo"}
PASSWORD = "demo-pass-123"

# The recipes server's own seed parser (recipes/server/manage.py), copied so this
# script needs no database access.
LEADING = re.compile(r"^(\d+(?:\.\d+)?)\s*(g|kg|ml|l|lb|oz)?\b\s*(.*)$", re.I)
GRAMS = {"g": 1, "kg": 1000, "lb": 453.592, "oz": 28.3495}
ALT = re.compile(r"\s*\((?:about\s+)?(\d+(?:\.\d+)?|[½¼¾⅓⅔])\s*([a-zA-Z ]*?)\)")
FRACTIONS = {"½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3}
ALT_UNITS = {"cups": "cup", "cup": "cup", "tbsp": "tbsp", "tsp": "tsp", "cloves": "clove", "clove": "clove",
             "lb": "lb", "lbs": "lb", "oz": "oz", "g": "g", "ml": "ml"}

# First words of an ingredient name -> the USDA search that finds it.
QUERIES = {
    "chicken": "chicken breast boneless skinless raw", "plain yogurt": "yogurt plain whole milk",
    "lemon juice": "lemon juice raw", "garlic": "garlic raw", "ginger": "ginger root raw",
    "garam masala": "spices curry powder", "ground cumin": "spices cumin seed",
    "roasted cumin": "spices cumin seed", "ground coriander": "spices coriander seed",
    "paprika": "spices paprika", "turmeric": "spices turmeric ground", "salt": "salt table",
    "cayenne": "spices pepper red or cayenne", "spicy chili": "spices chili powder",
    "ghee": "butter oil anhydrous", "onion": "onions raw", "large onion": "onions raw",
    "white onion": "onions raw", "crushed tomatoes": "tomatoes red ripe canned packed in tomato juice",
    "heavy cream": "cream fluid heavy whipping", "cucumber": "cucumber with peel raw",
    "fresh mint": "spearmint fresh", "beef chuck": "beef chuck arm pot roast raw",
    "dried guajillo": "peppers ancho dried", "dried ancho": "peppers ancho dried",
    "dried chipotle": "peppers ancho dried", "beef broth": "soup beef broth bouillon consomme",
    "apple cider": "vinegar cider", "dried oregano": "spices oregano dried",
    "ground cinnamon": "spices cinnamon ground", "neutral oil": "oil canola",
    "corn tortillas": "tortillas ready to bake or fry corn", "fresh cilantro": "coriander cilantro leaves raw",
    "lime": "limes raw", "oaxaca": "cheese monterey", "rolled oats": "oats raw",
    "milk": "milk reduced fat 2%", "chia seeds": "seeds chia seeds dried", "blueberries": "blueberries raw",
    "maple syrup": "syrups maple", "peanut butter": "peanut butter smooth style without salt",
}

FOODS_FILE = HERE / "recipe_foods.json"
foods = json.loads(FOODS_FILE.read_text()) if FOODS_FILE.exists() else {}


def login(username):
    r = requests.post(RECIPES + "/api/accounts/login", headers=KEY, json={"username": username, "password": PASSWORD}, timeout=60)
    r.raise_for_status()
    return r.json()["token"]


def health_token(username):
    r = requests.post(HEALTH + "/api/accounts/login", json={"username": username, "password": PASSWORD}, timeout=60)
    r.raise_for_status()
    return r.json()["token"]


def call(token, method, path, body=None):
    r = requests.request(method, RECIPES + path, json=body, headers={**KEY, "Authorization": f"Bearer {token}"}, timeout=60)
    if r.status_code >= 400:
        raise SystemExit(f"{method} {path}: {r.status_code} {r.text[:200]}")
    return r.json()


def match(htoken, name):
    lowered = name.lower()
    key = next((k for k in sorted(QUERIES, key=len, reverse=True) if lowered.startswith(k)), None)
    if not key:
        return None
    query = QUERIES[key]
    if query not in foods:
        res = requests.get(HEALTH + "/api/foods/search", params={"q": query, "page": 1},
                           headers={"Authorization": f"Bearer {htoken}"}, timeout=120).json()
        hits = [f for f in res.get("results", []) if f["source"] == "fdc"]
        words = [w for w in query.split() if len(w) >= 3]
        pick = next((f for f in hits if all(w in f["name"].lower() for w in words)), None) or (hits or [None])[0]
        if not pick:
            raise SystemExit(f"no food for {query}")
        foods[query] = {"source": "fdc", "source_id": str(pick["id"]), "name": pick["name"]}
        FOODS_FILE.write_text(json.dumps(foods, indent=1))
    food = foods[query]
    # Loads the food's detail into food_cache, which is what logging reads.
    requests.get(f"{HEALTH}/api/foods/detail/fdc/{food['source_id']}", headers={"Authorization": f"Bearer {htoken}"}, timeout=120)
    return food


def ingredient(htoken, text):
    m = LEADING.match(text.strip())
    if not m:
        return {"text": text.strip(), "name": text.strip()}
    qty, unit, name = float(m[1]), (m[2] or "").lower(), m[3].strip()
    item = {"text": text.strip(), "qty": qty, "unit": unit, "name": name}
    alt = ALT.search(name)
    if alt:
        word = alt[2].strip().lower()
        item["alt_qty"] = FRACTIONS.get(alt[1]) or float(alt[1])
        item["alt_unit"] = ALT_UNITS.get(word, word)
        item["name"] = re.sub(r"\s+,", ",", name[: alt.start()] + name[alt.end():]).strip()
    if unit in GRAMS:
        item["grams"] = round(qty * GRAMS[unit], 1)
    elif unit == "ml":
        item["grams"] = qty  # the app's ML_TO_G
    if item.get("grams"):
        food = match(htoken, item["name"])
        if food:
            item["food"] = food
    return item


def recipe(htoken, raw, visibility):
    body = {k: raw[k] for k in ("title", "description", "servings", "prep_minutes", "cook_minutes", "steps", "tags") if k in raw}
    body["ingredients"] = [ingredient(htoken, t) for t in raw["ingredients"]]
    if raw.get("scale_by") is not None:
        body["ingredients"][raw["scale_by"]]["main"] = True
    body["visibility"] = visibility
    return body


OATS = {
    "title": "Peanut Butter Overnight Oats",
    "description": "Five minutes the night before, breakfast for two mornings.",
    "servings": 2, "prep_minutes": 5, "cook_minutes": 0, "scale_by": 0,
    "ingredients": ["90 g rolled oats (1 cup)", "240 ml milk (1 cup)", "12 g chia seeds (1 tbsp)",
                    "32 g peanut butter (2 tbsp)", "20 g maple syrup (1 tbsp)", "150 g blueberries (1 cup)"],
    "steps": ["Stir the oats, milk, chia seeds, peanut butter and maple syrup together in a jar.",
              "Cover and refrigerate overnight, or at least 4 hours.",
              "Top with the blueberries and eat cold."],
    "tags": ["breakfast", "make ahead"],
}


def claro_habit(htoken):
    """A habit Claro fills in: practice minutes reaching the goal tick it."""
    h = {"Authorization": f"Bearer {htoken}"}
    requests.post(HEALTH + "/api/habits", headers=h, timeout=60, json={
        "name": "Spanish practice", "time_of_day": "anytime", "public": True, "cadence_days": 1,
        "practice": {"source": "claro", "goal_minutes": 10}}).raise_for_status()
    r = requests.post(HEALTH + "/api/practice/link", headers=h, json={"source": "claro"}, timeout=60)
    r.raise_for_status()
    (HERE / "links.json").write_text(json.dumps({"claro": r.json()["code"]}))


def main():
    people = ["sam", "jordan", "priya", "alex"]
    tokens = {u: login(u) for u in people}
    htoken = health_token("sam")
    claro_habit(htoken)
    for a, b in [("sam", "jordan"), ("priya", "sam")]:
        call(tokens[a], "POST", f"/api/friends/{b}")
        call(tokens[b], "POST", f"/api/friends/{a}")
    call(tokens["alex"], "POST", "/api/friends/sam")  # left pending: Sam has a request to answer

    ip = {r["title"]: r for r in json.loads((HERE.parent / "recipes/server/seed/instant_pot.json").read_text())["recipes"]}
    plan = [
        ("jordan", ip["Instant Pot Quesabirria"], "public"),
        ("priya", OATS, "friends"),
        ("sam", ip["Cucumber Mint Raita"], "friends"),
        ("sam", ip["Instant Pot Chicken Tikka Masala"], "friends"),
    ]
    for owner, raw, visibility in plan:
        made = call(tokens[owner], "POST", "/api/recipes", recipe(htoken, raw, visibility))
        print("recipe", owner, made["title"])
    jordans = call(tokens["sam"], "GET", "/api/feed")["recipes"]
    quesa = next(r for r in jordans if r["title"] == "Instant Pot Quesabirria")
    call(tokens["sam"], "POST", f"/api/recipes/{quesa['id']}/save")
    print("foods", len(foods))


if __name__ == "__main__":
    main()
