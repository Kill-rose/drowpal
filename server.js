require('dotenv').config();
const express = require('express');
const path = require('node:path');
const fs = require('node:fs');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.sqlite3');
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
const PAL_IMAGE_EXPRESSIONS = [
  { key: 'normal', label: '通常', src: '/assets/normal.png' },
  { key: 'happy', label: '笑顔', src: '/assets/joy.png' },
  { key: 'sad', label: '落ち込み', src: '/assets/slump.png' },
  { key: 'focused', label: '集中', src: '/assets/concentration.png' }
];

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const characterImageUpload = upload.fields(PAL_IMAGE_EXPRESSIONS.map((expression) => ({
  name: `palImage_${expression.key}`,
  maxCount: 1
})));

let database = null;

function getDb() {
  if (database) {
    return Promise.resolve(database);
  }

  return initializeDatabase(DB_PATH).then((db) => {
    database = db;
    return db;
  });
}

function initializeDatabase(dbPath = DB_PATH) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        reject(err);
        return;
      }

      db.serialize(() => {
        db.run(`
          CREATE TABLE IF NOT EXISTS characters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            personality TEXT NOT NULL,
            style TEXT NOT NULL,
            greeting TEXT NOT NULL,
            user_name TEXT NOT NULL DEFAULT '',
            interaction_style TEXT NOT NULL DEFAULT '',
            profile TEXT NOT NULL DEFAULT '',
            examples TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          }
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS reflections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            reflection_date TEXT NOT NULL,
            score INTEGER NOT NULL,
            note TEXT NOT NULL,
            hours REAL NOT NULL,
            illustration_id INTEGER,
            evaluation_data TEXT NOT NULL DEFAULT '[]',
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          }
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS illustrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            file_name TEXT NOT NULL,
            illustration_date TEXT NOT NULL DEFAULT '',
            illustration_type TEXT NOT NULL DEFAULT '練習',
            uploaded_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          }
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS usage_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT NOT NULL,
            detail TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          }
        });

        db.run(`
          CREATE TABLE IF NOT EXISTS character_images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            character_id INTEGER NOT NULL DEFAULT 1,
            expression TEXT NOT NULL UNIQUE,
            file_name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            reject(err);
          }
        });

        db.run("ALTER TABLE characters ADD COLUMN user_name TEXT NOT NULL DEFAULT ''", () => {});
        db.run("ALTER TABLE characters ADD COLUMN interaction_style TEXT NOT NULL DEFAULT ''", () => {});
        db.run("ALTER TABLE characters ADD COLUMN profile TEXT NOT NULL DEFAULT ''", () => {});
        db.run("ALTER TABLE characters ADD COLUMN examples TEXT NOT NULL DEFAULT '[]'", () => {});
        db.run('ALTER TABLE reflections ADD COLUMN illustration_id INTEGER', () => {});
        db.run("ALTER TABLE reflections ADD COLUMN evaluation_data TEXT NOT NULL DEFAULT '[]'", () => {});
        db.run("ALTER TABLE illustrations ADD COLUMN illustration_date TEXT NOT NULL DEFAULT ''", () => {});
        db.run("ALTER TABLE illustrations ADD COLUMN illustration_type TEXT NOT NULL DEFAULT '練習'", () => {});

        db.run(`
          INSERT OR IGNORE INTO characters (id, name, personality, style, greeting)
          VALUES (1, 'ミコ', '優しく励ましてくれる', 'やさしく短く、前向き', 'こんにちは。今日の気持ちを一緒に整理しよう。')
        `, (err) => {
          if (err) {
            reject(err);
            return;
          }

          resolve(db);
        });
      });
    });
  });
}

function runDb(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
        return;
      }
      resolve(this);
    });
  });
}

function getDbRow(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(row);
    });
  });
}

function getDbRows(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(rows);
    });
  });
}

const CHARACTER_FIELD_LIMITS = {
  name: 10,
  userName: 10,
  personality: 100,
  style: 100,
  interactionStyle: 100,
  profile: 1000
};
const MAX_EXAMPLE_COUNT = 9;
const MAX_EXAMPLE_LENGTH = 300;

function sanitizeText(value, maxLength) {
  return (value ?? '').toString().trim().slice(0, maxLength);
}

function normalizeExamples(value) {
  const list = Array.isArray(value) ? value : (value ? [value] : []);
  return list.map((item) => sanitizeText(item, MAX_EXAMPLE_LENGTH)).filter(Boolean).slice(0, MAX_EXAMPLE_COUNT);
}

async function getCharacterImages(db) {
  const rows = await getDbRows(db, 'SELECT expression, file_name FROM character_images WHERE character_id = ?', [1]);
  const images = Object.fromEntries(rows.map((row) => [row.expression, row.file_name]));
  return PAL_IMAGE_EXPRESSIONS.map((expression) => ({
    ...expression,
    src: images[expression.key] ? `/uploads/${images[expression.key]}` : expression.src
  }));
}

async function getCharacter(db) {
  const character = await getDbRow(db, 'SELECT * FROM characters ORDER BY id DESC LIMIT 1');
  if (character) {
    try {
      character.examplesList = JSON.parse(character.examples || '[]');
    } catch (error) {
      character.examplesList = [];
    }
  }
  return character;
}

async function saveUsage(db, action, detail) {
  await runDb(db, 'INSERT INTO usage_history (action, detail) VALUES (?, ?)', [action, detail]);
}

function buildCalendarData(reflections) {
  return reflections.reduce((acc, row) => {
    if (!acc[row.reflection_date]) {
      acc[row.reflection_date] = [];
    }
    acc[row.reflection_date].push(row.note);
    return acc;
  }, {});
}

function buildCalendarIllustrations(illustrations) {
  return illustrations.reduce((result, illustration) => {
    if (illustration.illustration_date && !result[illustration.illustration_date]) {
      result[illustration.illustration_date] = illustration;
    }
    return result;
  }, {});
}

function normalizeEvaluations(value) {
  try {
    const evaluations = Array.isArray(value) ? value : JSON.parse(value || '[]');
    return evaluations.map((item) => ({
      name: sanitizeText(item.name, 50),
      score: Math.min(5, Math.max(1, Number(item.score) || 3)),
      reason: sanitizeText(item.reason, 1000),
      presets: Array.isArray(item.presets) ? item.presets.slice(0, 9) : []
    })).filter((item) => item.name);
  } catch (error) {
    return [];
  }
}

function getMonthDays(year, month) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days = [];
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }
  return { firstDay, lastDay, days };
}

function getLocalDateString(date) {
  return date.toISOString().slice(0, 10);
}

function selectExpression(message) {
  if (/嬉|楽しい|最高|できた|成功|おめでとう/.test(message)) {
    return 'happy';
  }
  if (/悲|つら|疲れ|不安|失敗|落ち込/.test(message)) {
    return 'sad';
  }
  if (/集中|練習|描く|頑張|作業/.test(message)) {
    return 'focused';
  }
  return 'normal';
}

function parseAiReply(rawReply, message) {
  try {
    const parsed = JSON.parse(rawReply.replace(/^```json\s*|\s*```$/g, '').trim());
    return {
      reply: parsed.message || rawReply,
      expression: PAL_IMAGE_EXPRESSIONS.some((item) => item.key === parsed.expression) ? parsed.expression : selectExpression(message)
    };
  } catch (error) {
    return { reply: rawReply, expression: selectExpression(message) };
  }
}

async function generateAiReply(message, character) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return { reply: `${character.name}からのひとこと: ${message} について、今日の気持ちを大切にしながら、少しだけ一歩進めるように声をかけるね。`, expression: selectExpression(message) };
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          role: 'user',
          parts: [{ text: `あなたは${character.name}という名前のAIキャラクターです。性格は${character.personality}です。口調は${character.style}です。ユーザーのメッセージに対して、短く、励まし、次に進めるような返答をしてください。セリフに合う表情を normal（通常）、happy（笑顔）、sad（落ち込み）、focused（集中）から1つ選び、JSONのみで {"message":"セリフ","expression":"normal"} の形式で返してください。\n\nユーザー: ${message}` }]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (text) {
      const result = parseAiReply(text, message);
      return { reply: `${character.name}からのひとこと: ${result.reply}`, expression: result.expression };
    }
  } catch (error) {
    console.error(error);
  }

  return { reply: `${character.name}からのひとこと: ${message} について、まずは自分の気持ちを一言で書き出すことから始めよう。`, expression: selectExpression(message) };
}

app.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const character = await getCharacter(db);
    const characterImages = await getCharacterImages(db);
    const reflections = await getDbRows(db, 'SELECT * FROM reflections ORDER BY reflection_date DESC LIMIT 5');
    const illustrations = await getDbRows(db, 'SELECT * FROM illustrations ORDER BY uploaded_at DESC LIMIT 3');
    const reflectionCount = await getDbRow(db, 'SELECT COUNT(*) AS count FROM reflections');
    const illustrationCount = await getDbRow(db, 'SELECT COUNT(*) AS count FROM illustrations');
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthReflections = await getDbRows(db, 'SELECT * FROM reflections WHERE substr(reflection_date, 1, 7) = ? ORDER BY reflection_date ASC', [`${year}-${String(month + 1).padStart(2, '0')}`]);
    res.render('index', {
      character,
      reflections,
      illustrations,
      reflectionCount: reflectionCount.count,
      illustrationCount: illustrationCount.count,
      characterImages,
      palImagesJson: JSON.stringify(Object.fromEntries(characterImages.map((image) => [image.key, image.src]))).replace(/</g, '\\u003c'),
      year,
      month,
      monthData: getMonthDays(year, month),
      calendar: buildCalendarData(monthReflections)
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('サーバーエラー');
  }
});

app.get('/chat', async (req, res) => {
  try {
    const db = await getDb();
    const character = await getCharacter(db);
    const history = await getDbRows(db, 'SELECT * FROM usage_history WHERE action = ? ORDER BY created_at DESC LIMIT 8', ['chat']);
    res.render('chat', { character, history });
  } catch (error) {
    console.error(error);
    res.status(500).send('サーバーエラー');
  }
});

app.post('/chat', async (req, res) => {
  try {
    const db = await getDb();
    const message = req.body.message?.trim();
    if (!message) {
      return res.status(400).json({ error: 'メッセージを入力してください。' });
    }

    const character = await getCharacter(db);
    const response = await generateAiReply(message, character);
    await saveUsage(db, 'chat', message);
    res.json(response);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'AI応答の生成に失敗しました。' });
  }
});

app.get('/reflection', async (req, res) => {
  try {
    const db = await getDb();
    const illustrations = await getDbRows(db, 'SELECT * FROM illustrations ORDER BY illustration_date DESC, uploaded_at DESC');
    const reflections = await getDbRows(db, 'SELECT reflections.*, illustrations.title, illustrations.file_name FROM reflections LEFT JOIN illustrations ON illustrations.id = reflections.illustration_id ORDER BY reflections.reflection_date DESC');
    reflections.forEach((reflection) => {
      reflection.evaluations = normalizeEvaluations(reflection.evaluation_data);
    });
    const editReflection = reflections.find((reflection) => reflection.id === Number(req.query.edit)) || null;
    res.render('reflection', {
      reflections,
      illustrations,
      today: getLocalDateString(new Date()),
      selectedIllustrationId: editReflection?.illustration_id || Number(req.query.illustrationId) || null,
      editReflection,
      editReflectionJson: JSON.stringify(editReflection).replace(/</g, '\\u003c')
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('サーバーエラー');
  }
});

app.post('/reflection', async (req, res) => {
  try {
    const db = await getDb();
    const { reflectionDate, illustrationId, score, note, hours, evaluationData, reflectionId } = req.body;
    const date = reflectionDate || getLocalDateString(new Date());
    const evaluations = JSON.stringify(normalizeEvaluations(evaluationData));
    if (reflectionId) {
      await runDb(db, 'UPDATE reflections SET reflection_date = ?, illustration_id = ?, score = ?, note = ?, hours = ?, evaluation_data = ? WHERE id = ?', [date, Number(illustrationId) || null, Math.min(5, Math.max(1, Number(score) || 3)), note || '', Math.max(0, Number(hours) || 0), evaluations, Number(reflectionId)]);
    } else {
      await runDb(db, 'INSERT INTO reflections (reflection_date, illustration_id, score, note, hours, evaluation_data) VALUES (?, ?, ?, ?, ?, ?)', [date, Number(illustrationId) || null, Math.min(5, Math.max(1, Number(score) || 3)), note || '', Math.max(0, Number(hours) || 0), evaluations]);
    }
    await saveUsage(db, 'reflection', `${reflectionDate}: ${note}`);
    res.redirect('/reflection');
  } catch (error) {
    console.error(error);
    res.status(500).send('保存に失敗しました。');
  }
});

app.get('/calendar', async (req, res) => {
  try {
    const db = await getDb();
    const year = Number(req.query.year) || new Date().getFullYear();
    const month = Number(req.query.month) || new Date().getMonth();
    const illustrations = await getDbRows(db, 'SELECT * FROM illustrations WHERE substr(illustration_date, 1, 7) = ? ORDER BY uploaded_at DESC', [`${year}-${String(month + 1).padStart(2, '0')}`]);
    const calendar = buildCalendarIllustrations(illustrations);
    const monthData = getMonthDays(year, month);
    res.render('calendar', { year, month, monthData, calendar, illustrations });
  } catch (error) {
    console.error(error);
    res.status(500).send('カレンダー表示に失敗しました。');
  }
});

app.get('/character', async (req, res) => {
  try {
    const db = await getDb();
    const character = await getCharacter(db);
    const characterImages = await getCharacterImages(db);
    res.render('character', { character, characterImages });
  } catch (error) {
    console.error(error);
    res.status(500).send('キャラクター設定の読み込みに失敗しました。');
  }
});

app.post('/character', characterImageUpload, async (req, res) => {
  try {
    const db = await getDb();
    const { name, personality, style, userName, interactionStyle, profile, examples } = req.body;
    const values = [
      sanitizeText(name, CHARACTER_FIELD_LIMITS.name),
      sanitizeText(personality, CHARACTER_FIELD_LIMITS.personality),
      sanitizeText(style, CHARACTER_FIELD_LIMITS.style),
      sanitizeText(userName, CHARACTER_FIELD_LIMITS.userName),
      sanitizeText(interactionStyle, CHARACTER_FIELD_LIMITS.interactionStyle),
      sanitizeText(profile, CHARACTER_FIELD_LIMITS.profile),
      JSON.stringify(normalizeExamples(examples))
    ];
    await runDb(db, 'UPDATE characters SET name = ?, personality = ?, style = ?, user_name = ?, interaction_style = ?, profile = ?, examples = ? WHERE id = 1', values);

    for (const expression of PAL_IMAGE_EXPRESSIONS) {
      const file = req.files?.[`palImage_${expression.key}`]?.[0];
      if (!file) {
        continue;
      }
      await runDb(db, 'INSERT INTO character_images (character_id, expression, file_name) VALUES (?, ?, ?) ON CONFLICT(expression) DO UPDATE SET file_name = excluded.file_name, updated_at = CURRENT_TIMESTAMP', [1, expression.key, file.filename]);
    }

    await saveUsage(db, 'character', values[0]);
    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('設定の保存に失敗しました。');
  }
});

app.post('/reset', async (req, res) => {
  try {
    const db = await getDb();
    const uploadedFiles = await getDbRows(db, 'SELECT file_name FROM illustrations');

    await runDb(db, 'DELETE FROM reflections');
    await runDb(db, 'DELETE FROM illustrations');
    await runDb(db, 'DELETE FROM usage_history');
    await runDb(db, "UPDATE characters SET name = 'ミコ', personality = '優しく励ましてくれる', style = 'やさしく短く、前向き', greeting = 'こんにちは。今日の気持ちを一緒に整理しよう。' WHERE id = 1");

    uploadedFiles.forEach(({ file_name: fileName }) => {
      const filePath = path.join(UPLOAD_DIR, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    });

    res.redirect('/');
  } catch (error) {
    console.error(error);
    res.status(500).send('リセットに失敗しました。');
  }
});

app.get('/illustrations', async (req, res) => {
  try {
    const db = await getDb();
    const illustrations = await getDbRows(db, 'SELECT * FROM illustrations ORDER BY illustration_date DESC, uploaded_at DESC');
    res.render('illustrations', { illustrations, today: getLocalDateString(new Date()) });
  } catch (error) {
    console.error(error);
    res.status(500).send('イラスト一覧の読み込みに失敗しました。');
  }
});

app.post('/illustrations', upload.single('image'), async (req, res) => {
  try {
    const db = await getDb();
    const title = req.body.title?.trim() || 'アップロード画像';
    const fileName = req.file ? req.file.filename : '';
    if (!fileName) {
      return res.status(400).send('画像ファイルを選択してください。');
    }

    const illustrationDate = req.body.illustrationDate || getLocalDateString(new Date());
    const illustrationType = ['練習', '落書き', '本気'].includes(req.body.illustrationType) ? req.body.illustrationType : '練習';
    await runDb(db, 'INSERT INTO illustrations (title, file_name, illustration_date, illustration_type) VALUES (?, ?, ?, ?)', [title, fileName, illustrationDate, illustrationType]);
    await saveUsage(db, 'illustration', title);
    res.redirect('/illustrations');
  } catch (error) {
    console.error(error);
    res.status(500).send('アップロードに失敗しました。');
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Drowpal app listening on http://localhost:${PORT}`);
  });
}

module.exports = {
  app,
  initializeDatabase,
  buildCalendarData
};
