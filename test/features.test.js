const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('default pal expression assets are present', () => {
  const assetNames = ['normal.png', 'joy.png', 'slump.png', 'concentration.png'];
  for (const assetName of assetNames) {
    assert.ok(fs.existsSync(require('node:path').join(__dirname, '..', 'public', 'assets', assetName)));
  }
});
