/**
 * API CLIENT - Wrapper cho fetch tới Backend FastAPI
 */

const API = (() => {
  const BASE = window.APP_CONFIG.API_BASE;
  const TOKEN_KEY = window.APP_CONFIG.TOKEN_KEY;

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(window.APP_CONFIG.USER_KEY);
  }

  async function request(path, options = {}) {
    const url = BASE + "/api" + path;
    const headers = {
      ...(options.headers || {})
    };
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = headers["Content-Type"] || "application/json";
    }
    const token = getToken();
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

    let data;
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      data = await resp.json();
    } else {
      data = await resp.text();
    }

    if (!resp.ok) {
      const detail = (data && data.detail) || data || resp.statusText;
      if (resp.status === 401) {
        // Token hết hạn → clear và chuyển về login
        clearToken();
        if (!location.pathname.includes("login")) {
          location.href = "/pages/login.html";
        }
      }
      throw new APIError(typeof detail === "string" ? detail : "Có lỗi xảy ra", resp.status, data);
    }

    return data;
  }

  class APIError extends Error {
    constructor(message, status, data) {
      super(message);
      this.status = status;
      this.data = data;
    }
  }

  return {
    getToken, setToken, clearToken,
    APIError,

    // ---------- AUTH ----------
    register: (data) => request("/auth/register", { method: "POST", body: data }),
    login: (data) => request("/auth/login", { method: "POST", body: data }),
    logout: () => request("/auth/logout", { method: "POST" }),
    forgotPassword: (email) => request("/auth/forgot-password", { method: "POST", body: { email } }),
    resetPassword: (data) => request("/auth/reset-password", { method: "POST", body: data }),
    changePassword: (data) => request("/auth/change-password", { method: "POST", body: data }),
    me: () => request("/auth/me"),

    // ---------- USERS ----------
    getProfile: () => request("/users/me"),
    updateProfile: (data) => request("/users/me", { method: "PUT", body: data }),
    uploadAvatar: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return request("/users/me/avatar", { method: "POST", body: fd });
    },

    // ---------- SCHEDULES ----------
    getSchedules: () => request("/schedules/"),
    getUpcomingSchedules: () => request("/schedules/upcoming"),
    createSchedule: (data) => request("/schedules/", { method: "POST", body: data }),
    createBulkSchedules: (schedules) => request("/schedules/bulk", { method: "POST", body: { schedules } }),
    updateSchedule: (id, data) => request(`/schedules/${id}`, { method: "PUT", body: data }),
    deleteSchedule: (id) => request(`/schedules/${id}`, { method: "DELETE" }),
    deleteAllSchedules: () => request("/schedules/", { method: "DELETE" }),

    // ---------- SUBJECTS / GPA ----------
    getSubjects: () => request("/subjects/"),
    createSubject: (data) => request("/subjects/", { method: "POST", body: data }),
    createBulkSubjects: (items) => request("/subjects/bulk", { method: "POST", body: items }),
    updateSubject: (id, data) => request(`/subjects/${id}`, { method: "PUT", body: data }),
    deleteSubject: (id) => request(`/subjects/${id}`, { method: "DELETE" }),
    getGPA: () => request("/subjects/gpa"),
    predictGPA: (predicted) => request("/subjects/gpa/predict", { method: "POST", body: { predicted_subjects: predicted } }),

    // ---------- CURRICULUM / ADVANCED STUDY ----------
    getCurriculum: () => request("/curriculum/"),
    recommendAdvanced: () => request("/curriculum/recommend"),

    // ---------- NOTES ----------
    getNotes: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request("/notes/" + (q ? "?" + q : ""));
    },
    getNoteTags: () => request("/notes/tags"),
    createNote: (data) => request("/notes/", { method: "POST", body: data }),
    updateNote: (id, data) => request(`/notes/${id}`, { method: "PUT", body: data }),
    deleteNote: (id) => request(`/notes/${id}`, { method: "DELETE" }),

    // ---------- CHAT AI ----------
    chat: (message, session_id) => request("/chat/", { method: "POST", body: { message, session_id } }),
    getChatHistory: (session_id) => request(`/chat/history?session_id=${session_id}`),
    getChatSessions: () => request("/chat/sessions"),
    deleteChatSession: (id) => request(`/chat/sessions/${id}`, { method: "DELETE" }),

    // ---------- OCR ----------
    ocrExtract: (file, type) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("image_type", type);
      return request("/ocr/extract", { method: "POST", body: fd });
    },

    // ---------- ADMIN ----------
    adminGetUsers: (params = {}) => {
      const q = new URLSearchParams(params).toString();
      return request("/admin/users" + (q ? "?" + q : ""));
    },
    adminGetUser: (id) => request(`/admin/users/${id}`),
    adminUpdateUser: (id, data) => request(`/admin/users/${id}`, { method: "PUT", body: data }),
    adminResetPassword: (id) => request(`/admin/users/${id}/reset-password`, { method: "POST" }),
    adminDeleteUser: (id) => request(`/admin/users/${id}`, { method: "DELETE" }),
    adminStats: () => request("/admin/stats"),
    adminGetCurriculum: () => request("/admin/curriculum"),
    adminCreateCurriculum: (data) => request("/admin/curriculum", { method: "POST", body: data }),
    adminUpdateCurriculum: (id, data) => request(`/admin/curriculum/${id}`, { method: "PUT", body: data }),
    adminDeleteCurriculum: (id) => request(`/admin/curriculum/${id}`, { method: "DELETE" }),

    health: () => request("/health"),
  };
})();

window.API = API;


/* ============================================================
   COMMON UTILITIES - Toast, Modal, Confirm, Helpers
============================================================ */

const Toast = {
  container: null,
  ensureContainer() {
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "toast-container";
      document.body.appendChild(this.container);
    }
  },
  show(message, type = "info", title = "", duration = 4000) {
    this.ensureContainer();
    const icons = { success: "✓", error: "✕", warning: "⚠", info: "ⓘ" };
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || "ⓘ"}</div>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${escapeHtml(title)}</div>` : ""}
        <div class="toast-message">${escapeHtml(message)}</div>
      </div>
    `;
    this.container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = "toastIn 0.2s reverse";
      setTimeout(() => toast.remove(), 200);
    }, duration);
  },
  success(msg, title = "Thành công") { this.show(msg, "success", title); },
  error(msg, title = "Có lỗi") { this.show(msg, "error", title); },
  warning(msg, title = "Cảnh báo") { this.show(msg, "warning", title); },
  info(msg, title = "") { this.show(msg, "info", title); },
};
window.Toast = Toast;


const Modal = {
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
      </div>
    `;
    if (typeof body === "string") {
      backdrop.querySelector(".modal-body").innerHTML = body;
    } else if (body instanceof Node) {
      backdrop.querySelector(".modal-body").appendChild(body);
    }
    if (footer) {
      if (typeof footer === "string") {
        backdrop.querySelector(".modal-footer").innerHTML = footer;
      } else if (footer instanceof Node) {
        backdrop.querySelector(".modal-footer").appendChild(footer);
      }
    }
    const close = () => {
      backdrop.style.animation = "fadeIn 0.15s reverse";
      setTimeout(() => {
        backdrop.remove();
        onClose && onClose();
      }, 150);
    };
    backdrop.querySelector(".modal-close").addEventListener("click", close);
    backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
    document.body.appendChild(backdrop);
    return { el: backdrop, close };
  },

  confirm(message, title = "Xác nhận") {
    return new Promise((resolve) => {
      const footer = document.createElement("div");
      footer.innerHTML = `
        <button class="btn btn-secondary" data-action="cancel">Hủy</button>
        <button class="btn btn-danger" data-action="ok">Xác nhận</button>
      `;
      const modal = this.show({
        title,
        body: `<p style="margin:0">${escapeHtml(message)}</p>`,
        footer,
        size: "sm",
      });
      footer.querySelector('[data-action="cancel"]').onclick = () => { modal.close(); resolve(false); };
      footer.querySelector('[data-action="ok"]').onclick = () => { modal.close(); resolve(true); };
    });
  },
};
window.Modal = Modal;


function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
window.escapeHtml = escapeHtml;


function formatDateTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN") + " " + d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}
window.formatDateTime = formatDateTime;

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("vi-VN");
}
window.formatDate = formatDate;

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return Math.floor(diff / 60) + " phút trước";
  if (diff < 86400) return Math.floor(diff / 3600) + " giờ trước";
  if (diff < 604800) return Math.floor(diff / 86400) + " ngày trước";
  return d.toLocaleDateString("vi-VN");
}
window.timeAgo = timeAgo;

function dayName(d) {
  return ["", "", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"][d] || "";
}
window.dayName = dayName;

function gradeColor(letter) {
  const map = {
    "A": "success", "A+": "success",
    "B": "info", "B+": "info",
    "C": "warning", "C+": "warning",
    "D": "warning", "D+": "warning",
    "F": "danger",
  };
  return map[letter] || "secondary";
}
window.gradeColor = gradeColor;


/* Auth helpers */
function getCurrentUser() {
  const raw = localStorage.getItem(window.APP_CONFIG.USER_KEY);
  return raw ? JSON.parse(raw) : null;
}
window.getCurrentUser = getCurrentUser;

function setCurrentUser(user) {
  localStorage.setItem(window.APP_CONFIG.USER_KEY, JSON.stringify(user));
}
window.setCurrentUser = setCurrentUser;

function requireAuth() {
  if (!API.getToken()) {
    location.href = "/pages/login.html";
    return false;
  }
  return true;
}
window.requireAuth = requireAuth;

function requireAdmin() {
  const u = getCurrentUser();
  if (!u || u.role !== "admin") {
    location.href = "/pages/app.html";
    return false;
  }
  return true;
}
window.requireAdmin = requireAdmin;

async function logout() {
  try { await API.logout(); } catch (e) {}
  API.clearToken();
  location.href = "/pages/login.html";
}
window.doLogout = logout;
