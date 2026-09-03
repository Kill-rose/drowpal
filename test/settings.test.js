const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('character setting views include all required fields and presets', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'character.ejs'), 'utf8');
  assert.match(view, /name="name"/);
  assert.match(view, /name="personality"/);
  assert.match(view, /name="style"/);
  assert.match(view, /name="userName"/);
  assert.match(view, /name="interactionStyle"/);
  assert.match(view, /name="profile"/);
  assert.match(view, /name="examples"/);
  assert.match(view, /name="palImage_<%= image\.key %>"/);
  assert.match(view, /characterImages\.forEach/);
});

test('index view exposes pal image and chat controls', () => {
  const view = fs.readFileSync(path.join(__dirname, '..', 'views', 'index.ejs'), 'utf8');
  assert.match(view, /id="pal-image"/);
  assert.match(view, /id="chat-form"/);
});

test('style.css defines character image layout', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'public', 'style.css'), 'utf8');
  assert.match(css, /\.character-image/);
});
