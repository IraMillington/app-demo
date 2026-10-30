// Builds a demo learner's saved state with Claro's own functions: two weeks of
// reviews scheduled by its FSRS code, finished course units, and a few
// recorded slips. Prints the localStorage entries the web build reads.
import { initialState, rate, rememberAttempt, DAY, completeLesson, type State } from "./src/learning";
import { beginCourse, advanceCourse, courseSupport, answerCourseStory, saveCourseDraft, answerCourseProduction, markCourseSpoken } from "./src/courseState";
import { courseUnits } from "./src/courseContent";
import { recordMistakes } from "./src/mistakes";
import { STORAGE_KEY as PRACTICE_KEY, addPractice, parseLog } from "./src/practiceTime";
import { PRIMARY_KEY } from "./src/persistence";

const end = Number(process.argv[2]);
const start = end - 14 * DAY;
let rng = 11;
const rand = () => ((rng = (rng * 16807) % 2147483647) / 2147483647);

let s: State = initialState();
s = { ...s, onboarded: true, profile: { ...s.profile, name: "Sam", dailyGoal: 10, level: "returning" } };

const done = ["everyday-intro", "everyday-routine", "everyday-cafe", "everyday-time", "everyday-directions", "everyday-shopping", "everyday-past", "everyday-repair", "everyday-plans", "everyday-people"];
// Each finished unit is walked through its four stages with the app's own course functions.
done.forEach((id, i) => {
  const at = start + Math.floor((i / done.length) * 12 * DAY) + 19 * 3600_000;
  const u = courseUnits.find((x) => x.id === id)!;
  s = beginCourse(s, id, at);
  s = advanceCourse(s, id, 0, at + 4 * 60_000);
  s = courseSupport(s, id, "heard");
  s = answerCourseStory(s, id, i % 4 === 3 ? (u.correct + 1) % u.options.length : u.correct, at + 9 * 60_000);
  s = advanceCourse(s, id, 1, at + 10 * 60_000);
  s = saveCourseDraft(s, id, u.challenge.answer);
  s = answerCourseProduction(s, id, u.challenge.answer, at + 16 * 60_000);
  s = advanceCourse(s, id, 2, at + 17 * 60_000);
  s = markCourseSpoken(s, id);
  s = advanceCourse(s, id, 3, at + 24 * 60_000);
});
s = beginCourse(s, "everyday-feelings", end - 3600_000);
s = completeLesson(s, "welcome");

// Reviews: each day, phrases from the units started by then, through Claro's own rate().
const phrasesFor = (id: string) => courseUnits.find((u) => u.id === id)!.phrases.map((_, i) => `${id}-${i + 1}`);
for (let day = 0; day < 14; day++) {
  const t0 = start + day * DAY + 8 * 3600_000;
  if (day === 9) continue; // a missed day
  const open = done.filter((_, i) => (i / done.length) * 12 <= day);
  const pool = open.flatMap(phrasesFor);
  const count = 6 + Math.floor(rand() * 6);
  for (let k = 0; k < count; k++) {
    const id = pool[Math.floor(rand() * pool.length)];
    const r = rand();
    const rating = r < 0.15 ? "again" : r < 0.35 ? "hard" : "good";
    const at = t0 + k * 90_000;
    s = rememberAttempt(s, id, rand() < 0.7 ? "recall" : "listen", { firstAnswer: "", support: "none", comparison: rating === "good" ? "match" : "compare" }, at);
    s = rate(s, id, s.pendingAttempts[`${id}:recall`] ? "recall" : "listen", rating, at + 30_000);
  }
  if (day % 3 === 1) s = recordMistakes(s, ["age-tener"], "writing", t0 + 3600_000);
  if (day % 4 === 2) s = recordMistakes(s, ["gustar-agreement", "accent-missing"], "writing", t0 + 3700_000);
}

let log = parseLog(null);
for (let day = 0; day < 14; day++) {
  if (day === 9) continue;
  log = addPractice(log, start + day * DAY + 12 * 3600_000, (8 + Math.floor(rand() * 18)) * 60);
}
console.log(JSON.stringify({ [PRIMARY_KEY]: JSON.stringify(s), [PRACTICE_KEY]: JSON.stringify(log) }));
