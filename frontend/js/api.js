/**
 * API CLIENT - Wrapper cho fetch tới Backend FastAPI
 * Viết theo hướng đối tượng (OOP):
 *   - APIError    : lớp lỗi tuỳ biến (kế thừa Error – Inheritance)
 *   - ApiClient   : lớp đóng gói toàn bộ giao tiếp HTTP với backend (Encapsulation)
 *   - ToastManager, ModalManager : lớp quản lý UI dùng chung
 *   - Formatter   : lớp tiện ích định dạng dữ liệu (static methods)
 *   - AuthHelper  : lớp tiện ích xác thực phía client (static methods)
 */

/* 1) APIError - lớp lỗi tuỳ biến, kế thừa từ Error (Inheritance) */
class APIError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = "APIError";
    this.status = status;
    this.data = data;
  }
}
window.APIError = APIError;


/* 2) ApiClient - lớp đóng gói toàn bộ API call tới backend */
class ApiClient {
  constructor(config) {
    this.baseUrl = config.API_BASE;
    this.tokenKey = config.TOKEN_KEY;
    this.userKey = config.USER_KEY;
  }

  getToken()        { return localStorage.getItem(this.tokenKey); }
  setToken(token)   { localStorage.setItem(this.tokenKey, token); }
  clearToken() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  async _request(path, options = {}) {
    const url = this.baseUrl + "/api" + path;
    const headers = { ...(options.headers || {}) };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    const token = this.getToken();
    if (token) headers["Authorization"] = "Bearer " + token;

    const opts = { ...options, headers };
    if (opts.body && typeof opts.body === "object" && !(opts.body instanceof FormData)) {
      opts.body = JSON.stringify(opts.body);
    }

    let resp;
    try {
      resp = await fetch(url, opts);
    } catch (e) {
      throw new APIError("Không thể kết nối tới máy chủ. Vui lòng kiểm tra mạng.", 0);
    }

    if (resp.status === 204) return null;
    const contentType = resp.headers.get("content-type") || "";
    const data = contentType.includes("application/json") ? await resp.json() : await resp.text();

    if (!resp.ok) {
      const detail = (data && data.detail) || data || resp.statusText;
      if (resp.status === 401) {
        this.clearToken();
        if (!location.pathname.includes("login")) location.href = "/pages/login.html";
      }
      throw new APIError(typeof detail === "string" ? detail : "Có lỗi xảy ra", resp.status, data);
    }
    return data;
  }

  request(path, options = {}) { return this._request(path, options); }

  // AUTH
  register(data)        { return this._request("/auth/register", { method: "POST", body: data }); }
  login(data)            { return this._request("/auth/login", { method: "POST", body: data }); }
  logout()               { return this._request("/auth/logout", { method: "POST" }); }
  forgotPassword(email)  { return this._request("/auth/forgot-password", { method: "POST", body: { email } }); }
  resetPassword(data)    { return this._request("/auth/reset-password", { method: "POST", body: data }); }
  changePassword(data)   { return this._request("/auth/change-password", { method: "POST", body: data }); }
  me()                    { return this._request("/auth/me"); }

  // USERS
  getProfile()           { return this._request("/users/me"); }
  updateProfile(data)    { return this._request("/users/me", { method: "PUT", body: data }); }
  uploadAvatar(file) {
    const fd = new FormData(); fd.append("file", file);
    return this._request("/users/me/avatar", { method: "POST", body: fd });
  }

  // SCHEDULES
  getSchedules()              { return this._request("/schedules/"); }
  getUpcomingSchedules()      { return this._request("/schedules/upcoming"); }
  createSchedule(data)        { return this._request("/schedules/", { method: "POST", body: data }); }
  createBulkSchedules(schedules) { return this._request("/schedules/bulk", { method: "POST", body: { schedules } }); }
  updateSchedule(id, data)    { return this._request(`/schedules/${id}`, { method: "PUT", body: data }); }
  deleteSchedule(id)          { return this._request(`/schedules/${id}`, { method: "DELETE" }); }
  deleteAllSchedules()        { return this._request("/schedules/", { method: "DELETE" }); }

  // SUBJECTS / GPA
  getSubjects()                { return this._request("/subjects/"); }
  createSubject(data)          { return this._request("/subjects/", { method: "POST", body: data }); }
  createBulkSubjects(items)    { return this._request("/subjects/bulk", { method: "POST", body: items }); }
  updateSubject(id, data)      { return this._request(`/subjects/${id}`, { method: "PUT", body: data }); }
  deleteSubject(id)            { return this._request(`/subjects/${id}`, { method: "DELETE" }); }
  getGPA()                     { return this._request("/subjects/gpa"); }
  predictGPA(predicted) {
    return this._request("/subjects/gpa/predict", { method: "POST", body: { predicted_subjects: predicted } });
  }

  // CURRICULUM / HỌC VƯỢT
  getCurriculum()        { return this._request("/curriculum/"); }
  recommendAdvanced()    { return this._request("/curriculum/recommend"); }
  saveStudyPlan(codes)   { return this._request("/curriculum/save-plan", { method: "POST", body: { subject_codes: codes } }); }
  getStudyPlan()          { return this._request("/curriculum/plan"); }

  // NOTES
  getNotes(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._request("/notes/" + (q ? "?" + q : ""));
  }
  getNoteTags()          { return this._request("/notes/tags"); }
  createNote(data)       { return this._request("/notes/", { method: "POST", body: data }); }
  updateNote(id, data)   { return this._request(`/notes/${id}`, { method: "PUT", body: data }); }
  deleteNote(id)         { return this._request(`/notes/${id}`, { method: "DELETE" }); }

  // CHAT AI
  chat(message, session_id) {
    return this._request("/chat/", { method: "POST", body: { message, session_id } });
  }
  chatWithFile(message, sessionId, file) {
    const fd = new FormData();
    fd.append("message", message);
    if (sessionId) fd.append("session_id", sessionId);
    if (file) fd.append("file", file);
    return this._request("/chat/with-file", { method: "POST", body: fd });
  }
  getChatHistory(session_id)  { return this._request(`/chat/history?session_id=${session_id}`); }
  getChatSessions()            { return this._request("/chat/sessions"); }
  deleteChatSession(id)        { return this._request(`/chat/sessions/${id}`, { method: "DELETE" }); }

  // OCR
  ocrExtract(file, type) {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("image_type", type);
    return this._request("/ocr/extract", { method: "POST", body: fd });
  }

  // ADMIN
  adminGetUsers(params = {}) {
    const q = new URLSearchParams(params).toString();
    return this._request("/admin/users" + (q ? "?" + q : ""));
  }
  adminGetUser(id)             { return this._request(`/admin/users/${id}`); }
  adminUpdateUser(id, data)    { return this._request(`/admin/users/${id}`, { method: "PUT", body: data }); }
  adminResetPassword(id)       { return this._request(`/admin/users/${id}/reset-password`, { method: "POST" }); }
  adminDeleteUser(id)          { return this._request(`/admin/users/${id}`, { method: "DELETE" }); }
  adminStats()                  { return this._request("/admin/stats"); }
  adminGetCurriculum()          { return this._request("/admin/curriculum"); }
  adminCreateCurriculum(data)  { return this._request("/admin/curriculum", { method: "POST", body: data }); }
  adminUpdateCurriculum(id, data) { return this._request(`/admin/curriculum/${id}`, { method: "PUT", body: data }); }
  adminDeleteCurriculum(id)    { return this._request(`/admin/curriculum/${id}`, { method: "DELETE" }); }

  health() { return this._request("/health"); }
}

window.API = new ApiClient(window.APP_CONFIG);


/* 3) ToastManager - lớp quản lý thông báo nổi (toast) */
class ToastManager {
  constructor() { this._container = null; }

  _ensureContainer() {
    if (!this._container) {
      this._container = document.createElement("div");
      this._container.className = "toast-container";
      document.body.appendChild(this._container);
    }
    return this._container;
  }

  show(message, type = "info", title = "", duration = 4000) {
    const container = this._ensureContainer();
    const icons = { success: "✓", error: "✕", warning: "⚠", info: "ⓘ" };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || "ⓘ"}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${Formatter.escapeHtml(title)}</div>` : ""}
        <div class="toast-message">${Formatter.escapeHtml(message)}</div>
      </div>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "toastIn 0.2s reverse";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  success(msg, title = "Thành công") { this.show(msg, "success", title); }
  error(msg, title = "Có lỗi")        { this.show(msg, "error", title); }
  warning(msg, title = "Cảnh báo")    { this.show(msg, "warning", title); }
  info(msg, title = "")                { this.show(msg, "info", title); }
}
window.Toast = new ToastManager();


/* 4) ModalManager - lớp quản lý hộp thoại (modal) và xác nhận */
class ModalManager {
  show({ title, body, footer, onClose, size = "md" }) {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    const sizeClass = size === "lg" ? ' style="max-width:760px"' : (size === "sm" ? ' style="max-width:400px"' : "");
    backdrop.innerHTML = `
      <div class="modal"${sizeClass}>
        <div class="modal-header">
          <h3 class="modal-title">${title || ""}</h3>
          <button class="modal-close" type="button">×</button>
        </div>
        <div class="modal-body"></div>
        ${footer ? `<div class="modal-footer"></div>` : ""}
      </div>`;
    if (typeof body === "string") backdrop.querySelector(".modal-body").innerHTML = body;
    else if (body instanceof Node) backdrop.querySelector(".modal-body").appendChild(body);
    if (footer) {
      if (typeof footer === "string") backdrop.querySelector(".modal-footer").innerHTML = footer;
      else if (footer instanceof Node) backdrop.querySelector(".modal-footer").appendChild(footer);
    }
    const close = () => {
      backdrop.style.animation = "fadeIn 0.15s reverse";
      setTimeout(() => { backdrop.remove(); onClose && onClose(); }, 150);
    };
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    return { el: backdrop, close };
  }

  confirm(message, title = "Xác nhận") {
    return new Promise((resolve) => {
      const footer = document.createElement("div");
      footer.innerHTML = `
        <button class="btn btn-secondary" data-action="cancel">Hủy</button>
        <button class="btn btn-danger" data-action="ok">Xác nhận</button>`;
      const modal = this.show({
        title, body: `<p style="margin:0">${Formatter.escapeHtml(message)}</p>`, footer, size: "sm",
      });
      footer.querySelector('[data-action="cancel"]').onclick = () => { modal.close(); resolve(false); };
      footer.querySelector('[data-action="ok"]').onclick = () => { modal.close(); resolve(true); };
    });
  }
}
window.Modal = new ModalManager();


/* 5) Formatter - lớp tiện ích định dạng (chỉ dùng static methods) */
class Formatter {
  static escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  static formatDateTime(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  static formatDate(iso) { return iso ? new Date(iso).toLocaleDateString("vi-VN") : ""; }
  static timeAgo(iso) {
    if (!iso) return "";
    const diff = (Date.now() - new Date(iso).getTime()) / 1000;
    if (diff < 60) return "vừa xong";
    if (diff < 3600) return Math.floor(diff / 60) + " phút trước";
    if (diff < 86400) return Math.floor(diff / 3600) + " giờ trước";
    if (diff < 604800) return Math.floor(diff / 86400) + " ngày trước";
    return new Date(iso).toLocaleDateString("vi-VN");
  }
  static dayName(d) {
    return ["", "", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"][d] || "";
  }
  static gradeColor(letter) {
    const map = { "A":"success","A+":"success","B":"info","B+":"info",
                  "C":"warning","C+":"warning","D":"warning","D+":"warning","F":"danger" };
    return map[letter] || "secondary";
  }
}
window.Formatter = Formatter;

window.escapeHtml     = Formatter.escapeHtml;
window.formatDateTime = Formatter.formatDateTime;
window.formatDate     = Formatter.formatDate;
window.timeAgo        = Formatter.timeAgo;
window.dayName        = Formatter.dayName;
window.gradeColor     = Formatter.gradeColor;


/* 6) AuthHelper - lớp tiện ích xác thực phía client (static methods) */
class AuthHelper {
  static getCurrentUser() {
    const raw = localStorage.getItem(window.APP_CONFIG.USER_KEY);
    return raw ? JSON.parse(raw) : null;
  }
  static setCurrentUser(user) {
    localStorage.setItem(window.APP_CONFIG.USER_KEY, JSON.stringify(user));
  }
  static requireAuth() {
    if (!API.getToken()) { location.href = "/pages/login.html"; return false; }
    return true;
  }
  static requireAdmin() {
    const u = AuthHelper.getCurrentUser();
    if (!u || u.role !== "admin") { location.href = "/pages/app.html"; return false; }
    return true;
  }
  static async logout() {
    try { await API.logout(); } catch (e) { /* ignore */ }
    API.clearToken();
    location.href = "/pages/login.html";
  }
}
window.AuthHelper = AuthHelper;

window.getCurrentUser = AuthHelper.getCurrentUser;
window.setCurrentUser = AuthHelper.setCurrentUser;
window.requireAuth    = AuthHelper.requireAuth;
window.requireAdmin   = AuthHelper.requireAdmin;
window.doLogout       = AuthHelper.logout;
