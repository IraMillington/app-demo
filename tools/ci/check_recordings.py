"""Refuses a recording that could carry anything real into the public site:
real household names, credentials, or a failed tour (no responses, server errors)."""
import hashlib
import json
import re
import sys

# Usage: check_recordings.py <file> [minimum exchanges, default 60]. A file
# that is not a list of exchanges (the PickleCourts tool transcript) is only
# checked for names and credentials.
data = json.load(open(sys.argv[1]))
recs = data if isinstance(data, list) else []
minimum = int(sys.argv[2]) if len(sys.argv) > 2 else 60
text = json.dumps(data)
problems = []
if isinstance(data, list) and len(recs) < minimum:
    problems.append(f"only {len(recs)} exchanges recorded")
for e in recs:
    if e["status"] >= 500:
        problems.append(f"{e['status']} on {e['method']} {e['path']}")
# Names from the migration's real profiles, stored as hashes so this public
# file does not spell them out. Words are split on case changes too.
NAMES = {"3a96b8af1e808ba3", "39328287ed8bce0d", "23178a848701a156"}
words = {w.lower() for w in re.findall(r"[A-Z]?[a-z]+|[A-Z]+", text)}
for w in words:
    if hashlib.sha256(w.encode()).hexdigest()[:16] in NAMES:
        problems.append(f"recording contains a real name ({w[:1]}…)")
# Anything credential-shaped.
for pattern in [r"@gmail", r"sk-or-", r"Bearer ", r"\"token\"", r"password"]:
    if re.search(pattern, text, re.I):
        problems.append(f"recording contains {pattern!r}")
if problems:
    sys.exit("recordings rejected:\n  " + "\n  ".join(problems))
print(f"recordings ok: {sys.argv[1]}, {len(recs)} exchanges")
