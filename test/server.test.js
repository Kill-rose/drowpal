const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { initializeDatabase, buildCalendarData } = require('../server');

test('initializeDatabase creates the required tables', async () => {
  const db = await initializeDatabase(path.join(__dirname, '..', 'tmp-test.db'));
  const tables = await new Promise((resolve, reject) => {
    db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, rows) => {
      if (err) reject(err);
      else resolve(rows.map((row) => row.name).sort());
    });
  });

  assert.ok(tables.includes('characters'));
  assert.ok(tables.includes('reflections'));
  assert.ok(tables.includes('illustrations'));
  assert.ok(tables.includes('usage_history'));
  assert.ok(tables.includes('character_images'));
  db.close();
});

test('buildCalendarData groups reflections by day', async () => {
  const result = buildCalendarData([
    { reflection_date: '2026-06-01', note: 'First' },
    { reflection_date: '2026-06-01', note: 'Second' },
    { reflection_date: '2026-06-02', note: 'Third' }
  ]);

  assert.deepEqual(result['2026-06-01'], ['First', 'Second']);
  assert.deepEqual(result['2026-06-02'], ['Third']);
});
