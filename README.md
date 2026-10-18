# MMM-EIHL

Compact MagicMirror² panel (310px) with subtle teal accents, score badges and shaded table rows, rotating between league scores/table and Challenge Cup scores/group tables every 20 seconds. Uses the official https://www.eliteleague.co.uk pages; no API key. Polls every ten minutes and retains the last successful data during outages.

## Install below Tado on the left

On the mirror:

```sh
cd ~/MagicMirror/modules
git clone https://github.com/Krisalexroberts/MMM-EIHL.git
cd MMM-EIHL
npm install --omit=dev
```

In your MagicMirror `config/config.js`, insert this entry **immediately after the Tado entry** in the `modules` array. MagicMirror orders modules in a region by their array order. Use the same left region as Tado if it uses `bottom_left` or `top_left` rather than the default below.

```js
{
  module: "MMM-EIHL",
  classes: "MMM-EIHL",
  position: "top_left", // Match Tado's position to appear directly beneath it
  config: {
    width: "310px",
    maxScores: 4,
    favoriteTeam: "", // Optional, e.g. "Sheffield"
    rotateInterval: 20 * 1000,
    updateInterval: 10 * 60 * 1000
  }
},
```

Restart MagicMirror after installation. Node 18.17+ with built-in fetch is required.

## Playoffs and seasons

Each score row labels the competition (League, Challenge Cup or Play Offs) and any named round supplied by EIHL, such as Quarter-Final, Semi-Final, Final or an elimination game. Friendly/exhibition stages are labelled Friendly when identified by the source; this does not add a separate friendly fixture feed. FT denotes a completed match, distinct from the Final round. Labels share the existing small date/status line, preserving the panel size; long text is truncated with the full label available on hover.

On game days, the existing score area rotates between Recent scores and Today's games. In-progress games use the official scoreboard score and status, with a Live scores heading; before face-off they show start times, and completed games show Final. The score area stays the same height in both views, with up to `maxScores` games per view and extra games paginated. Standings stay beneath it. `liveUpdateInterval` defaults to 60000 milliseconds (one minute, minimum 30 seconds); this lightweight scoreboard poll runs only on days with scheduled games. The full fixture/table refresh keeps its normal ten-minute interval. Updates depend on the official site's publishing speed.

The module discovers the latest published league and matching Cup season automatically. Set `season: "2026/2027"` to pin a season. League postseason fixtures marked Quarterfinal, Semifinal, Final or Playoff by EIHL are separated into a Playoffs page. This appears when at least one playoff fixture is within 14 days of today (configurable with `playoffWindowDays`), and shows recent scores plus the next fixtures and their rounds. Cup knockout scores stay in the Challenge Cup page; official group tables remain visible. Scores reflect the published schedule and are not guaranteed live/final game status. No aggregate winner or bracket is inferred from individual legs.

The official site has no stable public API contract: if its HTML changes, the parser may require an update. Requests retry transient failures; unavailable feeds show a warning and retain the last successful standings.

## Check

`npm test` runs parser tests against saved official-page fixtures, including Cup groups and postseason rounds.
