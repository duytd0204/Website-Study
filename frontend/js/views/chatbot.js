/**
 * Chatbot View - Trợ lý AI (Use Case 3.6)
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.chatbot = async function(container) {
  let sessions = await API.getChatSessions().catch(() => []);
  let currentSession = null;
  let messages = [];

  const SUGGESTIONS = [
    "GPA hiện tại của tôi là bao nhiêu?",
    "Tôi nên học vượt môn nào?",
    "Cho tôi tips ôn thi cuối kỳ hiệu quả",
    "Học hệ tín chỉ là như thế nào?",
    "Tôi có những lịch học nào hôm nay?",
    "Làm sao để cải thiện GPA?",
  ];

  // Generate session ID nếu chưa có
  if (sessions.length === 0) {
    currentSession = "sess_" + Date.now();
  } else {
    currentSession = sessions[0].session_id;
    messages = await loadHistory(currentSession);
  }

  render();

  function render() {
    container.innerHTML = `
      <div class="chat-container">
        <!-- Sessions sidebar -->
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <button class="btn btn-primary btn-block btn-sm" id="btnNewSession">+ Cuộc trò chuyện mới</button>
          </div>
          <div class="chat-sessions" id="sessionsList"></div>
        </div>

        <!-- Chat main -->
        <div class="chat-main">
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-suggestions" id="chatSuggestions"></div>
          <div class="chat-input-area">
            <textarea class="chat-input" id="chatInput" placeholder="Đặt câu hỏi cho AI..." rows="1"></textarea>
            <button class="btn btn-primary" id="btnSendChat" title="Gửi">➤</button>
          </div>
        </div>
      </div>
    `;
    renderSessions();
    renderMessages();
    renderSuggestions();

    document.getElementById("btnNewSession").onclick = () => newSession();
    document.getElementById("btnSendChat").onclick = sendMessage;
    document.getElementById("chatInput").onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    };
    // Auto-resize textarea
    document.getElementById("chatInput").oninput = (e) => {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    };
  }

  function renderSessions() {
    const el = document.getElementById("sessionsList");
    if (sessions.length === 0) {
      el.innerHTML = `<div class="empty-state" style="padding:20px"><p class="text-sm text-muted">Chưa có cuộc trò chuyện</p></div>`;
      return;
    }
    el.innerHTML = sessions.map(s => `
      <div class="chat-session-item ${s.session_id === currentSession ? 'active' : ''}" data-id="${escapeHtml(s.session_id)}">
        <div class="chat-session-title">${escapeHtml(s.title || "Cuộc trò chuyện")}</div>
        <div class="chat-session-meta">${timeAgo(s.last_at)} · ${s.message_count} tin</div>
      </div>
    `).join("");
    el.querySelectorAll(".chat-session-item").forEach(el2 => {
      el2.onclick = async () => {
        currentSession = el2.dataset.id;
        messages = await loadHistory(currentSession);
        render();
      };
    });
  }

  function renderMessages() {
    const el = document.getElementById("chatMessages");
    if (messages.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
          <div style="font-size:64px;margin-bottom:16px">🤖</div>
          <h3 style="color:var(--text-primary);margin-bottom:8px">Xin chào! Tôi là TLU AI Assistant</h3>
          <p style="margin-bottom:6px">Tôi có thể giúp bạn về học tập, lịch học, điểm số, và các câu hỏi học thuật khác.</p>
          <p class="text-sm">Hãy chọn câu hỏi gợi ý bên dưới hoặc đặt câu hỏi của bạn!</p>
        </div>
      `;
      return;
    }
    el.innerHTML = messages.map(m => {
      const isUser = m.role === "user";
      return `
        <div class="chat-msg ${isUser ? 'user' : 'assistant'}">
          <div class="chat-msg-avatar">${isUser ? "👤" : "🤖"}</div>
          <div>
            <div class="chat-msg-bubble">${escapeHtml(m.content)}</div>
            <div class="chat-msg-time">${timeAgo(m.created_at)}</div>
          </div>
        </div>
      `;
    }).join("");
    el.scrollTop = el.scrollHeight;
  }

  function renderSuggestions() {
    const el = document.getElementById("chatSuggestions");
    if (messages.length > 0) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = SUGGESTIONS.map(s => `<button class="chat-suggestion" data-text="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("");
    el.querySelectorAll(".chat-suggestion").forEach(b => {
      b.onclick = () => {
        document.getElementById("chatInput").value = b.dataset.text;
        sendMessage();
      };
    });
  }

  async function loadHistory(sessionId) {
    try {
      return await API.getChatHistory(sessionId);
    } catch (e) {
      return [];
    }
  }

  function newSession() {
    currentSession = "sess_" + Date.now();
    messages = [];
    render();
  }

  async function sendMessage() {
    const input = document.getElementById("chatInput");
    const text = input.value.trim();
    if (!text) return;

    // Push user message
    messages.push({ role: "user", content: text, created_at: new Date().toISOString() });
    input.value = "";
    input.style.height = "auto";

    // Add loading
    messages.push({ role: "assistant", content: "...", created_at: new Date().toISOString(), _loading: true });
    renderMessages();

    try {
      const res = await API.chat(text, currentSession);
      // Replace loading with actual response
      messages.pop();
      messages.push({ role: "assistant", content: res.reply, created_at: new Date().toISOString() });
      renderMessages();
      // Reload sessions to update
      sessions = await API.getChatSessions().catch(() => []);
      renderSessions();
    } catch (err) {
      messages.pop();
      messages.push({ role: "assistant", content: "❌ " + err.message, created_at: new Date().toISOString() });
      renderMessages();
    }
  }
};
