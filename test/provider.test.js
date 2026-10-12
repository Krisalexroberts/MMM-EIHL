const {test} = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {discover, games, standings} = require("../provider");
const fixture = name => fs.readFileSync(path.join(__dirname, "fixtures", name + ".html"), "utf8");
test("discovers matching season and Cup without hardcoded IDs", () => {
  const d = discover(fixture("league"));
  assert.equal(d.year, "2026/2027"); assert.match(d.cup.path, /58/);
  assert.throws(() => discover(fixture("league"), "2099/2100"));
});
test("reads both results and unplayed games, retaining overtime", () => {
  const g = games(fixture("league"));
  assert.ok(g.some(x => x.home === "Guildford Flames" && x.away === "Glasgow Clan" && x.score === "4:3"));
  assert.ok(g.some(x => x.played && /OT/.test(x.score)));
  assert.ok(g.some(x => !x.played && x.score === "-:-"));
  assert.ok(g.every(x => /^\d{4}-\d{2}-\d{2}$/.test(x.date)));
});
test("league points and GP use published column headers", () => {
  const t = standings(fixture("standings"));
  assert.equal(t[0].rows.length, 10);
  assert.deepEqual(t[0].rows[0], {team:"Cardiff Devils", rank:1, gp:4, pts:8});
});
test("Cup groups remain separate", () => {
  const t = standings(fixture("cup-standings"));
  assert.deepEqual(t.map(g => g.name), ["A", "B"]);
  assert.equal(t.reduce((n,g) => n + g.rows.length, 0), 10);
  assert.ok(games(fixture("cup")).length);
});
test("postseason detection includes all four rounds and excludes league games", () => {
  const g = games(fixture("playoffs"));
  for (const stage of ["Quarterfinal", "Semifinal", "Final", "Third Place Playoff"]) assert.ok(g.some(x => x.stage === stage && x.playoff), stage);
  assert.ok(g.some(x => !x.playoff));
});
test("source changes are explicit errors", () => {
  assert.throws(() => games("<html></html>"));
  assert.throws(() => standings("<table></table>"));
});
