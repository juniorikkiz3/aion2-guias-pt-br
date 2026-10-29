// Exercise the actual imported daily rollover against previously saved progress.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const code = fs.readFileSync(path.join(__dirname, '../dist/assets/js/tracker.js'), 'utf8');
assert.ok(code.includes("var KEY = 'aion2-tracker-v1'"));
const rollover = code.match(/function rollWeeks\(now\) \{[\s\S]*?return changed;\s*\}/);
assert.ok(rollover, 'Expected the imported tracker rollover function');
const saved = {
  active: 'main', member: true,
  chars: [{id: 'main', name: 'Principal', cls: 'cleric', il: 2700,
    week: 12, done: {transcendence: 3}, w1: {story: true},
    energy: {v: 400, t: 1000, cap: 840}}],
  server: {week: 12, done: {daily_dungeon: 9, shugo: 2}}
};
let week = 12, day = 70;
const context = vm.createContext({state: structuredClone(saved), weekIndex: () => week, dayIndex: () => day});
vm.runInContext(rollover[0], context);
const snapshot = () => JSON.parse(JSON.stringify(context.state));
vm.runInContext('rollWeeks(0)', context);
let actual = snapshot();
assert.deepEqual(actual.chars[0].done, saved.chars[0].done);
assert.deepEqual(actual.server.done, saved.server.done);
assert.deepEqual(actual.chars[0].w1, saved.chars[0].w1);
assert.deepEqual(actual.chars[0].energy, saved.chars[0].energy);
assert.equal(actual.active, saved.active);
assert.equal(actual.member, true);
// Same day: daily progress is retained. Next day: only daily counters reset.
vm.runInContext('state.chars[0].daily = {supply: 1}; state.server.daily = {duty: 3}; rollWeeks(0)', context);
assert.deepEqual(snapshot().server.daily, {duty: 3});
day++;
vm.runInContext('rollWeeks(0)', context);
actual = snapshot();
assert.deepEqual(actual.server.daily, {});
assert.deepEqual(actual.chars[0].daily, {});
assert.deepEqual(actual.server.done, saved.server.done);
assert.deepEqual(actual.chars[0].done, saved.chars[0].done);
// The normal weekly reset still clears weekly counts, retaining durable progress.
week++;
vm.runInContext('rollWeeks(0)', context);
actual = snapshot();
assert.deepEqual(actual.server.done, {});
assert.deepEqual(actual.chars[0].done, {});
assert.deepEqual(actual.chars[0].w1, saved.chars[0].w1);
assert.deepEqual(actual.chars[0].energy, saved.chars[0].energy);
assert.equal(actual.chars[0].id, 'main');
console.log('Tracker storage: saved progress retained; daily and weekly reset boundaries passed.');
