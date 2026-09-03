document.addEventListener('DOMContentLoaded', () => {
  const palImage = document.getElementById('pal-image');
  const menuButtons = document.querySelectorAll('[data-view-target]');
  const featureViews = document.querySelectorAll('[data-view]');
  const output = document.getElementById('chat-comments');
  const showFeatureView = async (viewName) => {
    featureViews.forEach((view) => view.classList.toggle('is-active', view.dataset.view === viewName));
    menuButtons.forEach((button) => button.classList.toggle('is-active', button.dataset.viewTarget === viewName));
    if (output) {
      try {
        const response = await fetch(`/api/menu-message?menu=${encodeURIComponent(viewName)}`);
        const data = await response.json();
        if (data.message) {
          output.textContent = data.message;
        }
      } catch (error) {
        output.textContent = 'メッセージを取得できませんでした。';
      }
    }
  };

  menuButtons.forEach((button) => {
    button.addEventListener('click', () => showFeatureView(button.dataset.viewTarget));
  });

  const requestedView = new URLSearchParams(window.location.search).get('view');
  if (requestedView && document.querySelector(`[data-view="${requestedView}"]`)) {
    showFeatureView(requestedView);
  }

  const form = document.getElementById('chat-form');
  const input = document.getElementById('message');
  const chatPanel = document.querySelector('.chat-panel');
  const chatModeToggle = document.getElementById('chat-mode-toggle');

  chatModeToggle?.addEventListener('click', () => {
    const isInputMode = chatPanel.dataset.chatMode === 'input';
    chatPanel.dataset.chatMode = isInputMode ? 'comments' : 'input';
    chatModeToggle.textContent = isInputMode ? '入力' : 'コメント';
  });

  if (!form || !output || !input) {
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) {
      return;
    }

    output.insertAdjacentHTML('beforeend', `<div class="chat-bubble">あなた: ${message}</div>`);
    input.value = '';

    try {
      const response = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      output.insertAdjacentHTML('beforeend', `<div class="chat-bubble ai">${data.reply || data.error}</div>`);
      if (palImage && window.palImages?.[data.expression]) {
        palImage.src = window.palImages[data.expression];
      }
      chatPanel.dataset.chatMode = 'comments';
      chatModeToggle.textContent = '入力';
      output.scrollTop = output.scrollHeight;
    } catch (error) {
      output.insertAdjacentHTML('beforeend', '<div class="chat-bubble ai">通信に失敗しました。</div>');
    }
  });
});
