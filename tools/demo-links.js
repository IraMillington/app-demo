// Saved state for the two phones that talk to Health: Recipes (signed in as Sam,
// diary linked) and Claro (practice minutes linked to Sam's "Spanish practice"
// habit, with 13 minutes practiced today, not yet sent). The tour uses the real
// codes the demo server issued; the site uses placeholders, since replay answers
// every call itself.
const fs = require('fs');

const TODAY_SECONDS = 13 * 60;

function claroStorage(seedFile, code, demoDate) {
  const seed = JSON.parse(fs.readFileSync(seedFile, 'utf8'));
  const log = JSON.parse(seed['claro.practiceTime.v1']);
  log.seconds[demoDate] = TODAY_SECONDS;
  log.code = code;
  delete log.lastSent;
  return { ...seed, 'claro.practiceTime.v1': JSON.stringify(log) };
}

function recipesStorage(token, code) {
  return { session_token: token, health_link_code: code, whats_new_seen_v1: '9999', unit_system: 'us' };
}

module.exports = { claroStorage, recipesStorage };
