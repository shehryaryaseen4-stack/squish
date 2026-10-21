// Verifies every level. A stored solution (src/data/solutions.json) that still
// wins is kept; otherwise the BFS solver searches for one. With --write the
// results are saved; they drive par moves, hints and the automated tests.
// --force re-solves everything, --set=<id>:<moves> stores a hand-made solution.
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { compileLevel } from '../src/game/core/compile';
import { solve } from '../src/game/core/solver';
import { replay } from '../src/game/core/engine';
import { ALL_LEVELS, DAILY_LEVELS } from '../src/data/levels/index';

const args = process.argv.slice(2);
const write = args.includes('--write');
const force = args.includes('--force');
const filter = args.find((a) => !a.startsWith('--'));
const budget = Number(args.find((a) => a.startsWith('--budget='))?.slice(9) ?? 1500000);
const file = new URL('../src/data/solutions.json', import.meta.url);
const stored: Record<string, string> = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
for (const a of args.filter((x) => x.startsWith('--set='))) {
  const [id, moves] = a.slice(6).split(':');
  stored[id] = moves;
}
let bad = 0;
for (const def of [...ALL_LEVELS, ...DAILY_LEVELS]) {
  if (filter && !def.id.startsWith(filter)) continue;
  const L = compileLevel(def);
  const prev = stored[def.id];
  if (!force && prev !== undefined && replay(L, prev)?.status === 1) {
    console.log(`ok ${def.id} ${def.title.padEnd(26)} ${String(prev.length).padStart(3)} moves (stored)  ${prev}`);
    continue;
  }
  const t0 = Date.now();
  const r = solve(L, undefined, budget, args.includes('--prune') || !!def.echo);
  const ms = Date.now() - t0;
  if (!r.solution) {
    bad++;
    delete stored[def.id];
    console.log(`XX ${def.id} ${def.title}: ${r.exhausted ? 'UNSOLVABLE' : 'budget exceeded'} (${r.explored} states, ${ms}ms)`);
    continue;
  }
  stored[def.id] = r.solution;
  console.log(`ok ${def.id} ${def.title.padEnd(26)} ${String(r.solution.length).padStart(3)} moves ${String(r.explored).padStart(8)} states ${ms}ms  ${r.solution}`);
}
if (write) {
  const sorted = Object.fromEntries(Object.entries(stored).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(file, JSON.stringify(sorted, null, 1) + '\n');
}
console.log(bad ? `${bad} level(s) failed` : 'all solved');
process.exit(bad ? 1 : 0);
