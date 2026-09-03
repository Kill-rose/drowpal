document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reflection-form');
  if (!form) return;

  const defaults = ['構図', '表現', 'ストーリー', '頑張り'];
  const person = ['ポーズ', '顔', '表情', '手', '足', '体バランス', '衣装'];
  const landscape = ['パース・遠近感', '光と影', '色彩・配色', '質感表現', '空気感・奥行き'];
  const presets = ['根気強く描けた', '妥協して描いた', '正しく描けた', '資料を見て描けた', '資料を見ずに描いた', '好みに描けた', '好みの絵にならなかった', '集中できなかった', '時間をかけられた'];
  const items = document.getElementById('evaluation-items');
  const addButton = document.getElementById('add-evaluation');
  const dateInput = form.elements.reflectionDate;
  const illustrationSelect = form.elements.illustrationId;
  const overallScore = form.elements.score;

  function scoreButtons(container, score) {
    return [1, 2, 3, 4, 5].map((value) => `<button type="button" class="score-dot ${value <= score ? 'is-selected' : ''}" data-score="${value}">${value <= score ? '●' : '○'}</button>`).join('');
  }

  function addItem(name = '', type = 'custom', evaluation = null) {
    const entry = document.createElement('fieldset');
    entry.className = 'evaluation-item';
    entry.dataset.type = type;
    entry.innerHTML = `
      <div class="evaluation-item-header"><button type="button" class="evaluation-toggle" aria-label="開閉">▼</button><input type="text" class="evaluation-name" value="${name}" maxlength="7" required /><button type="button" class="secondary remove-evaluation">削除</button></div>
      <div class="evaluation-body">
        <div class="score-picker item-score" data-score="${evaluation?.score || 3}">${scoreButtons(null, evaluation?.score || 3)}</div>
        <label>評価理由<textarea class="evaluation-reason" rows="2">${evaluation?.reason || ''}</textarea></label>
        <div class="reason-presets">${presets.map((preset) => `<label><input type="checkbox" value="${preset}" ${evaluation?.presets?.includes(preset) ? 'checked' : ''} /> ${preset}</label>`).join('')}</div>
      </div>`;
    items.append(entry);
  }

  function syncTypeItems(type, names) {
    const checked = form.querySelector(`[data-type="${type}"]`).checked;
    if (checked) {
      names.forEach((name) => {
        if (![...items.querySelectorAll('.evaluation-item')].some((item) => item.dataset.type === type && item.querySelector('.evaluation-name').value === name)) addItem(name, type);
      });
    } else {
      items.querySelectorAll(`.evaluation-item[data-type="${type}"]`).forEach((item) => item.remove());
    }
  }

  const draft = window.reflectionDraft;
  if (draft?.evaluations?.length) {
    draft.evaluations.forEach((evaluation) => {
      const type = person.includes(evaluation.name) ? 'person' : (landscape.includes(evaluation.name) ? 'landscape' : (defaults.includes(evaluation.name) ? 'default' : 'custom'));
      addItem(evaluation.name, type, evaluation);
    });
    form.querySelector('[data-type="person"]').checked = draft.evaluations.some((evaluation) => person.includes(evaluation.name));
    form.querySelector('[data-type="landscape"]').checked = draft.evaluations.some((evaluation) => landscape.includes(evaluation.name));
  } else {
    defaults.forEach((name) => addItem(name, 'default'));
  }
  form.querySelectorAll('[data-type]').forEach((input) => input.addEventListener('change', () => {
    syncTypeItems('person', person);
    syncTypeItems('landscape', landscape);
  }));
  addButton.addEventListener('click', () => addItem('新しい評価項目'));

  form.addEventListener('click', (event) => {
    const remove = event.target.closest('.remove-evaluation');
    if (remove) remove.closest('.evaluation-item').remove();
    const toggle = event.target.closest('.evaluation-toggle');
    if (toggle) {
      const item = toggle.closest('.evaluation-item');
      const collapsed = item.classList.toggle('is-collapsed');
      toggle.textContent = collapsed ? '▶' : '▼';
    }
    const scoreButton = event.target.closest('.score-dot');
    if (scoreButton) {
      const picker = scoreButton.closest('.item-score');
      const score = Number(scoreButton.dataset.score);
      picker.dataset.score = score;
      picker.innerHTML = scoreButtons(null, score);
    }
  });

  form.querySelector('[data-score-picker]').addEventListener('click', (event) => {
    const button = event.target.closest('[data-score]');
    if (!button) return;
    const score = Number(button.dataset.score);
    overallScore.value = score;
    event.currentTarget.innerHTML = scoreButtons(null, score);
  });

  illustrationSelect.addEventListener('change', () => {
    const selected = illustrationSelect.selectedOptions[0];
    if (selected?.dataset.date) dateInput.value = selected.dataset.date;
  });
  if (illustrationSelect.selectedOptions[0]?.dataset.date) dateInput.value = illustrationSelect.selectedOptions[0].dataset.date;

  form.addEventListener('submit', () => {
    const evaluations = [...items.querySelectorAll('.evaluation-item')].map((item) => ({
      name: item.querySelector('.evaluation-name').value.trim(),
      score: Number(item.querySelector('.item-score').dataset.score),
      reason: item.querySelector('.evaluation-reason').value.trim(),
      presets: [...item.querySelectorAll('.reason-presets input:checked')].map((input) => input.value)
    })).filter((item) => item.name);
    document.getElementById('evaluation-data').value = JSON.stringify(evaluations);
  });
});
