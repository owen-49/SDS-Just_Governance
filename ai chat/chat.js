
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');

const AI_ENDPOINT = 'http://localhost:8000/ai/ask'; // Backend AI endpoint

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
  addMessage('AI is thinking...', 'ai');
  chatMessages.scrollTop = chatMessages.scrollHeight;

  if (AI_ENDPOINT) {
    try {
      const res = await fetch(AI_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: userText,
          level: "beginner" // You can make this dynamic based on user profile
        })
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();
      const aiReply = data.answer || 'AI unable to generate a response';
      replaceLastAIMessage(aiReply);
      messages.push({ text: aiReply, role: 'ai' });
      saveMessages();
    } catch (error) {
      console.error('AI request failed:', error);
      replaceLastAIMessage('Request failed, please try again later. Make sure the backend server is running.');
    }
  } else {
    // Simulate response
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
