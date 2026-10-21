// Debug helper: print a level with coordinates and replay a move string.
import { compileLevel } from '../src/game/core/compile';
import { initialState, step } from '../src/game/core/engine';
import { ALL_LEVELS, DAILY_LEVELS } from '../src/data/levels/index';
const [id, moves = ''] = process.argv.slice(2);
const def = [...ALL_LEVELS, ...DAILY_LEVELS].find((d) => d.id === id)!;
const L = compileLevel(def);
let s = initialState(L);
const show = () => {
  const rows = def.map.replace(/\r/g, '').split('\n');
  void rows;
  for (let y = 0; y < L.h; y++) {
    let r = '';
    for (let x = 0; x < L.w; x++) {
      const i = y * L.w + x;
      r += s.p === i ? '@' : s.ghost === i ? 'g' : s.blocks.includes(i) ? 'B' : '.#xE-'[L.terrain[i] - 1] ?? ' ';
    }
    console.log(String(y).padStart(2) + ' ' + r);
  }
  console.log(`act=${s.act} pow=${s.pow} exitOpen=${s.exitOpen} keys=${s.keys} timers=${s.timers} tick=${s.tick} echo=${s.echo} rec=${s.rec} grav=${s.grav} status=${s.status} plat=${s.plat}`);
};
show();
for (const ch of moves) {
  const r = step(L, s, 'NESW.RF'.indexOf(ch));
  console.log(`-- ${ch} ${r ? r.events.map((e) => e.t).join(',') : 'INVALID'}`);
  if (r) s = r.state;
  show();
}
