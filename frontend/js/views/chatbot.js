/**
 * ChatbotView - Trợ lý AI (Use Case 3.6), hỗ trợ đính kèm ảnh/PDF.
 * Toàn bộ state hội thoại (sessions, currentSession, messages, file đính
 * kèm) là thuộc tính instance, không còn biến closure rời rạc.
 */
class ChatbotView extends BaseView {
  static SUGGESTIONS = [
    "GPA hiện tại của tôi là bao nhiêu?",
    "Tôi nên học vượt môn nào?",
    "Cho tôi tips ôn thi cuối kỳ hiệu quả",
    "Học hệ tín chỉ là như thế nào?",
    "Tôi có những lịch học nào hôm nay?",
    "Làm sao để cải thiện GPA?",
  ];

  constructor(container) {
    super(container);
    this.attachedFile = null;
    this.messages = [];
  }

  async render() {
    this.sessions = await API.getChatSessions().catch(() => []);
    if (this.sessions.length === 0) {
      this.currentSession = "sess_" + Date.now();
    } else {
      this.currentSession = this.sessions[0].session_id;
      this.messages = await this._loadHistory(this.currentSession);
    }
    this._renderPage();
  }

  _renderPage() {
    this.setHTML(`
      <div class="chat-container">
        <div class="chat-sidebar">
          <div class="chat-sidebar-header">
            <button class="btn btn-primary btn-block btn-sm" id="btnNewSession">+ Cuộc trò chuyện mới</button>
          </div>
          <div class="chat-sessions" id="sessionsList"></div>
        </div>

        <div class="chat-main">
          <div class="chat-messages" id="chatMessages"></div>
          <div class="chat-suggestions" id="chatSuggestions"></div>
          <div id="filePreviewBar" style="display:none;padding:6px 14px;background:var(--info-bg);font-size:12px;border-top:1px solid var(--border-light);align-items:center;gap:8px">
            <span id="filePreviewName" style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span>
            <button id="btnClearFile" style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:16px;line-height:1">×</button>
          </div>
          <div class="chat-input-area">
            <label title="Đính kèm ảnh / PDF" style="cursor:pointer;padding:8px;color:var(--text-secondary);font-size:18px">
              📎
              <input type="file" id="chatFileInput" accept="image/*,.pdf,.txt" style="display:none">
            </label>
            <textarea class="chat-input" id="chatInput" placeholder="Đặt câu hỏi cho AI... (có thể đính kèm ảnh hoặc PDF)" rows="1"></textarea>
            <button class="btn btn-primary" id="btnSendChat" title="Gửi">Gửi</button>
          </div>
        </div>
      </div>
    `);

    this._renderSessions();
    this._renderMessages();
    this._renderSuggestions();
    this._bindEvents();
  }

  _bindEvents() {
    this.$("#btnNewSession").onclick = () => this._newSession();
    this.$("#btnSendChat").onclick = () => this._sendMessage();
    this.$("#btnClearFile").onclick = () => this._clearAttachedFile();

    this.$("#chatFileInput").onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { Toast.error("File không được lớn hơn 10MB"); return; }
      this.attachedFile = f;
      const bar = this.$("#filePreviewBar");
      bar.style.display = "flex";
      this.$("#filePreviewName").textContent = "Đính kèm: " + f.name;
    };

    this.$("#chatInput").onkeydown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        this._sendMessage();
      }
    };
    this.$("#chatInput").oninput = (e) => {
      e.target.style.height = "auto";
      e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
    };
  }

  _clearAttachedFile() {
    this.attachedFile = null;
    this.$("#chatFileInput").value = "";
    this.$("#filePreviewBar").style.display = "none";
  }

  _renderSessions() {
    const el = this.$("#sessionsList");
    if (this.sessions.length === 0) {
      el.innerHTML = `<div class="empty-state" style="padding:20px"><p class="text-sm text-muted">Chưa có cuộc trò chuyện</p></div>`;
      return;
    }
    el.innerHTML = this.sessions.map(s => `
      <div class="chat-session-item ${s.session_id === this.currentSession ? 'active' : ''}" data-id="${Formatter.escapeHtml(s.session_id)}">
        <div class="chat-session-title">${Formatter.escapeHtml(s.title || "Cuộc trò chuyện")}</div>
        <div class="chat-session-meta">${Formatter.timeAgo(s.last_at)} · ${s.message_count} tin</div>
      </div>
    `).join("");
    el.querySelectorAll(".chat-session-item").forEach(el2 => {
      el2.onclick = async () => {
        this.currentSession = el2.dataset.id;
        this.messages = await this._loadHistory(this.currentSession);
        this._renderPage();
      };
    });
  }

  _renderMessages() {
    const el = this.$("#chatMessages");
    if (this.messages.length === 0) {
      el.innerHTML = `
        <div style="text-align:center;padding:48px 20px;color:var(--text-muted)">
          <h3 style="color:var(--text-primary);margin-bottom:8px">Xin chào! Tôi là TLU AI Assistant</h3>
          <p style="margin-bottom:6px">Tôi có thể giúp bạn về học tập, lịch học, điểm số, và các câu hỏi học thuật khác.</p>
          <p class="text-sm">Hãy chọn câu hỏi gợi ý bên dưới hoặc đặt câu hỏi của bạn!</p>
        </div>
      `;
      return;
    }
    el.innerHTML = this.messages.map(m => {
      const isUser = m.role === "user";
      return `
        <div class="chat-msg ${isUser ? 'user' : 'assistant'}">
          <div class="chat-msg-avatar">${isUser ? "Tôi" : "AI"}</div>
          <div>
            <div class="chat-msg-bubble">${Formatter.escapeHtml(m.content)}</div>
            <div class="chat-msg-time">${Formatter.timeAgo(m.created_at)}</div>
          </div>
        </div>
      `;
    }).join("");
    el.scrollTop = el.scrollHeight;
  }

  _renderSuggestions() {
    const el = this.$("#chatSuggestions");
    if (this.messages.length > 0) { el.innerHTML = ""; return; }
    el.innerHTML = ChatbotView.SUGGESTIONS.map(s =>
      `<button class="chat-suggestion" data-text="${Formatter.escapeHtml(s)}">${Formatter.escapeHtml(s)}</button>`
    ).join("");
    el.querySelectorAll(".chat-suggestion").forEach(b => {
      b.onclick = () => {
        this.$("#chatInput").value = b.dataset.text;
        this._sendMessage();
      };
    });
  }

  async _loadHistory(sessionId) {
    try { return await API.getChatHistory(sessionId); }
    catch (e) { return []; }
  }

  _newSession() {
    this.currentSession = "sess_" + Date.now();
    this.messages = [];
    this._renderPage();
  }

  async _sendMessage() {
    const input = this.$("#chatInput");
    const text = input.value.trim();
    if (!text) return;

    const displayText = this.attachedFile ? text + `\n[Đính kèm: ${this.attachedFile.name}]` : text;
    this.messages.push({ role: "user", content: displayText, created_at: new Date().toISOString() });
    input.value = "";
    input.style.height = "auto";

    this.messages.push({ role: "assistant", content: "...", created_at: new Date().toISOString(), _loading: true });
    this._renderMessages();

    const fileToSend = this.attachedFile;
    if (this.attachedFile) this._clearAttachedFile();

    try {
      const res = fileToSend
        ? await API.chatWithFile(text, this.currentSession, fileToSend)
        : await API.chat(text, this.currentSession);
      this.messages.pop();
      this.messages.push({ role: "assistant", content: res.reply, created_at: new Date().toISOString() });
      this._renderMessages();
      this.sessions = await API.getChatSessions().catch(() => []);
      this._renderSessions();
    } catch (err) {
      this.messages.pop();
      this.messages.push({ role: "assistant", content: "Lỗi: " + err.message, created_at: new Date().toISOString() });
      this._renderMessages();
    }
  }
}

BaseView.register("chatbot", ChatbotView);
