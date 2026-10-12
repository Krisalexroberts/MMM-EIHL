const cheerio = require("cheerio");
const BASE = "https://www.eliteleague.co.uk";
const clean = s => s.replace(/\s+/g, " ").trim();

function discover(html, season) {
  const $ = cheerio.load(html);
  const options = $("#id_season option").toArray().map(el => ({label: clean($(el).text()), path: $(el).attr("value")}));
  const league = options.find(o => /elite.*league/i.test(o.label) && (!season || o.label.includes(season)));
  if (!league) throw new Error("EIHL season selector unavailable");
  const year = league.label.match(/\d{4}\/\d{4}/)?.[0];
  const cup = options.find(o => /challenge cup/i.test(o.label) && o.label.includes(year));
  return {year, league, cup};
}

function games(html) {
  const $ = cheerio.load(html), result = [];
  $("h2").each((_, heading) => {
    const match = $(heading).text().match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return;
    const date = `${match[3]}-${match[2]}-${match[1]}`;
    $(heading).nextUntil("h2").filter(".row").each((_, el) => {
      const columns = $(el).children("div");
      const teams = columns.eq(2), link = teams.find('a[href^="/game/"]').first();
      if (!link.length) return;
      const score = clean(link.text());
      const clone = teams.clone(); clone.find("img, .delta").remove();
      const names = clone.contents().toArray().filter(n => n.type === "text").map(n => clean(n.data)).filter(Boolean);
      if (names.length !== 2) throw new Error("EIHL game layout changed");
      const stage = clean(columns.eq(1).text());
      result.push({id: link.attr("href"), date, time: clean(columns.eq(0).text()), home: names[0], away: names[1], score, played: /^\d+\s*:\s*\d+/.test(score), stage, playoff: /quarter.?final|semi.?final|^final$|play.?off/i.test(stage)});
    });
  });
  if (!result.length) throw new Error("No EIHL fixtures parsed");
  return result;
}

function standings(html) {
  const $ = cheerio.load(html), groups = [];
  $("table").each((_, table) => {
    const headers = $(table).find("thead th").toArray().map(el => clean($(el).text()).toUpperCase());
    const gp = headers.indexOf("GP"), pts = headers.indexOf("PTS");
    if (gp < 0 || pts < 0) return;
    const rows = [];
    $(table).find("tbody tr").each((_, tr) => {
      const cells = $(tr).children("td"), team = clean(cells.first().find('a[href^="/team/"]').text());
      if (!team) return;
      rows.push({team, rank: rows.length + 1, gp: Number(clean(cells.eq(gp).text())), pts: Number(clean(cells.eq(pts).text()))});
    });
    if (rows.length) groups.push({name: clean($(table).find("caption").text()), rows});
  });
  if (!groups.length) throw new Error("EIHL standings layout changed");
  return groups;
}

async function fetchPage(path) {
  const url = new URL(path, BASE);
  if (url.origin !== BASE) throw new Error("Unexpected EIHL URL");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {signal: AbortSignal.timeout(30000)});
      if (!response.ok) throw new Error(`EIHL HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      if (attempt === 2) throw error;
    }
  }
}

async function load(config) {
  const index = await fetchPage("/schedule");
  const discovered = discover(index, config.season);
  const output = {season: discovered.year, competitions: [], errors: []};
  for (const key of ["league", "cup"]) {
    const option = discovered[key];
    if (!option) { output.errors.push(key); continue; }
    try {
      const id = new URL(option.path, BASE).searchParams.get("id_season");
      const year = discovered.year.slice(0, 4);
      const [schedule, table] = await Promise.all([
        fetchPage(`${option.path}&id_month=999`),
        fetchPage(`/standings/${year}/${id}-${key === "cup" ? "challenge-cup" : "elite-ice-hockey-league"}`)
      ]);
      output.competitions.push({key, title: key === "cup" ? "Challenge Cup" : "League", games: games(schedule), groups: standings(table), updated: Date.now()});
    } catch (error) { output.errors.push(key); console.error(`[MMM-EIHL] ${key}: ${error.message}`); }
  }
  return output;
}
module.exports = {discover, games, standings, load};
