const {test} = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
class Element {
  constructor(tag) { this.tag = tag; this.style = {}; this.children = []; }
  append(...nodes) { this.children.push(...nodes); }
  appendChild(node) { this.append(node); }
}
test('game-day rotation reuses the same score area and standings; overflow games paginate', () => {
  let module;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../MMM-EIHL.js'), 'utf8'), {Module:{register:(_,m)=>module=m}, document:{createElement:t=>new Element(t)}, Intl, Date});
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  module.config = {...module.defaults};
  const game = {date:today, time:'16:00', home:'Sheffield Steelers', away:'Guildford Flames', score:'0:1', live:true, status:'2nd 12:34'};
  module.eihlData = {competitions:[{key:'league',title:'League',updated:Date.now(),games:[...Array.from({length:5},(_,i)=>({...game,id:String(i)})),{...game, date:'2020-01-01',live:false,played:true}],groups:[{rows:[]}]}]};
  const panel = page => { module.page=page; return module.getDom(); };
  const recent = panel(0), live = panel(1), extra = panel(2);
  const scoreArea = root=>root.children.find(n=>n.className==='eihl-scores');
  assert.equal(scoreArea(recent).style.height, scoreArea(live).style.height);
  assert.equal(scoreArea(live).children[0].textContent,'Live scores');
  assert.equal(scoreArea(live).children.length,5);
  assert.equal(scoreArea(extra).children.length,2);
  assert.match(scoreArea(live).children[1].children[0].textContent,/2nd 12:34/);
  assert.equal(live.children.filter(n=>n.tag==='table').length,1);
  assert.equal(recent.children.filter(n=>n.tag==='table').length,1);
});
