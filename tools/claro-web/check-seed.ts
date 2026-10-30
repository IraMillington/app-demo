import { readFileSync } from "fs";
import { parseBackup } from "./src/learning";
const d = JSON.parse(readFileSync("../claro-seed.json", "utf8"));
try { parseBackup(d["claro.learning.v1"]); console.log("ok"); } catch (e) { console.log("ERR", (e as Error).message); }
