"""The demo profile's workout program and past sessions, through the server's own
training API: a four-day upper/lower program, five finished sessions logged with
the app's native workout logger, and a few walks."""
from datetime import date, datetime, timedelta, timezone
import sys
import uuid

import requests

BASE = "http://127.0.0.1:8080"
TODAY = date.fromisoformat(sys.argv[1])
t = requests.post(BASE + "/api/accounts/login", json={"username": "sam", "password": "demo-pass-123"}).json()["token"]
H = {"Authorization": f"Bearer {t}"}


def call(method, path, body=None):
    r = requests.request(method, BASE + path, headers=H, json=body, timeout=60)
    if r.status_code >= 400:
        raise SystemExit(f"{method} {path} {r.status_code} {r.text[:300]}")
    return r.json()


def ex(key, name, muscles, sets, lo, hi, rest=90, load=None):
    e = {"exercise_key": key, "display_name": name, "primary_muscles": muscles, "sets": sets,
         "rep_min": lo, "rep_max": hi, "rest_seconds": rest, "rir": 2}
    if load:
        e["load"] = load
    return e


TEMPLATES = [
    {"code": "A", "title": "Upper A", "estimated_minutes": 50, "exercises": [
        ex("incline-dumbbell-press", "Incline dumbbell press", ["chest"], 3, 8, 10, 120),
        ex("seated-cable-row", "Seated cable row", ["back"], 3, 10, 12),
        ex("dumbbell-lateral-raise", "Dumbbell lateral raise", ["shoulders"], 3, 12, 15, 60),
        ex("cable-triceps-pushdown", "Cable triceps pushdown", ["triceps"], 2, 10, 15, 60)]},
    {"code": "B", "title": "Lower A", "estimated_minutes": 55, "exercises": [
        ex("goblet-squat", "Goblet squat", ["quads", "glutes"], 3, 8, 10, 120),
        ex("romanian-deadlift", "Romanian deadlift", ["hamstrings", "glutes"], 3, 8, 10, 120),
        ex("walking-lunge", "Walking lunge", ["quads", "glutes"], 2, 10, 12),
        ex("plank", "Plank", ["core"], 3, 1, 1, 60, "bodyweight") | {"rep_min": None, "rep_max": None, "hold_seconds": 40}]},
    {"code": "C", "title": "Upper B", "estimated_minutes": 50, "exercises": [
        ex("lat-pulldown", "Lat pulldown", ["back"], 3, 10, 12),
        ex("dumbbell-bench-press", "Dumbbell bench press", ["chest"], 3, 8, 10, 120),
        ex("face-pull", "Face pull", ["rear delts"], 2, 12, 15, 60),
        ex("dumbbell-curl", "Dumbbell curl", ["biceps"], 2, 10, 12, 60)]},
    {"code": "D", "title": "Lower B", "estimated_minutes": 50, "exercises": [
        ex("hip-thrust", "Hip thrust", ["glutes"], 3, 8, 12, 120),
        ex("leg-press", "Leg press", ["quads"], 3, 10, 12, 120),
        ex("seated-leg-curl", "Seated leg curl", ["hamstrings"], 2, 10, 12),
        ex("standing-calf-raise", "Standing calf raise", ["calves"], 2, 12, 15, 60)]},
]

program = call("POST", "/api/training/programs", {
    "name": "Upper / Lower, 4 days", "mode": "native", "level": "intermediate",
    "notes": "Four rotating workouts, about 50 minutes each. Add weight once every set reaches the top of its rep range with two reps to spare.",
    "phases": [{"name": "Build", "weeks": 4, "rir": 2}, {"name": "Push", "rir": 1, "notes": "One rep closer to failure on working sets."}],
    "templates": TEMPLATES,
})
call("POST", f"/api/training/programs/{program['id']}/activate")
settings = call("GET", "/api/training/settings")
call("PUT", "/api/training/settings", {**{k: v for k, v in settings.items() if k != "id"}, "enabled": True, "preferred_logger": "native"})

# Weights per exercise for the first session of each workout; later ones add a little.
LOAD = {"incline-dumbbell-press": 35, "seated-cable-row": 85, "dumbbell-lateral-raise": 15, "cable-triceps-pushdown": 40,
        "goblet-squat": 45, "romanian-deadlift": 85, "walking-lunge": 25, "lat-pulldown": 80, "dumbbell-bench-press": 35,
        "face-pull": 30, "dumbbell-curl": 20, "hip-thrust": 115, "leg-press": 160, "seated-leg-curl": 70, "standing-calf-raise": 60}
CT = timezone(timedelta(hours=-5))
for n, back in enumerate((12, 10, 8, 5, 2)):
    tpl = TEMPLATES[n % 4]
    d = TODAY - timedelta(days=back)
    sid = str(uuid.uuid4())
    performed = datetime(d.year, d.month, d.day, 18, 10, tzinfo=CT).isoformat()
    call("POST", "/api/training/sessions", {"logger": "native", "id": sid, "program_id": program["id"], "template_code": tpl["code"],
                                             "local_date": d.isoformat(), "performed_at": performed})
    sets = []
    for e in tpl["exercises"]:
        for i in range(e["sets"]):
            row = {"id": str(uuid.uuid4()), "exercise_key": e["exercise_key"], "unit": "lb", "status": "completed", "rir": 2 if i < e["sets"] - 1 else 1}
            if e.get("hold_seconds"):
                row["hold_seconds"] = 40 + 5 * (n // 4)
            else:
                row["reps"] = e["rep_max"] - i
                row["weight"] = LOAD[e["exercise_key"]] + (5 if n >= 4 else 0)
            sets.append(row)
    call("PUT", f"/api/training/sessions/{sid}/runner", {"revision": 0, "state": "paused", "elapsed_seconds": tpl["estimated_minutes"] * 60, "sets": sets})
    call("POST", f"/api/training/sessions/{sid}/complete")
    print("session", tpl["title"], d)

for back in (1, 4, 7):
    d = TODAY - timedelta(days=back)
    call("POST", "/api/workouts", {"date": d.isoformat(), "type": "walking", "title": "Brisk walk", "duration_minutes": 35, "intensity": "moderate"})
print("training seeded")
