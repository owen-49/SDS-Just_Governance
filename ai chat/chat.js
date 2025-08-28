
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

const AI_ENDPOINT = null; // 预留接口，设置为你的后端地址

// 加载历史记录
let messages = JSON.parse(localStorage.getItem('ai-chat-history')) || [];

// 渲染历史消息
messages.forEach(msg => addMessage(msg.text, msg.role));

sendBtn.addEventListener('click', () => {
  const text = chatInput.value.trim();
  if (!text) return;
  addMessage(text, 'user');
  messages.push({ text, role: 'user' });
  saveMessages();
  chatInput.value = '';
  simulateOrFetchAIResponse(text);
});

function addMessage(text, role) {
  const div = document.createElement('div');
  div.className = `message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  div.appendChild(bubble);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function saveMessages() {
  localStorage.setItem('ai-chat-history', JSON.stringify(messages));
}

async function simulateOrFetchAIResponse(userText) {
  addMessage('AI Entering...', 'ai');
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (AI_ENDPOINT) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText })
      });
      const data = await res.json();
      const aiReply = data.reply || 'AI Unable to generate a response';
      replaceLastAIMessage(aiReply);
      messages.push({ text: aiReply, role: 'ai' });
      saveMessages();
    } catch (error) {
      replaceLastAIMessage('The request failed, try again later.');
    }
  } else {
    // 模拟回复
    setTimeout(() => {
      const aiReply = 'This is a mock response from the AI: ' + userText;
      replaceLastAIMessage(aiReply);
      messages.push({ text: aiReply, role: 'ai' });
      saveMessages();
    }, 1500);
  }
}

function replaceLastAIMessage(text) {
  const lastMsg = chatMessages.querySelector('.message.ai:last-child .bubble');
  if (lastMsg) lastMsg.textContent = text;
}
