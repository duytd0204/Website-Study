/**
 * AppShell - lớp điều khiển toàn bộ "khung" ứng dụng phía sinh viên:
 *   - Bảo vệ route (yêu cầu đăng nhập)
 *   - Hiển thị thông tin user trên sidebar
 *   - Router đơn giản dựa trên hash (#dashboard, #schedule, ...)
 *   - Theo dõi lịch học sắp tới để nhắc nhở
 *
 * Encapsulation: toàn bộ state (remindedIds, view hiện tại...) và hành vi
 * liên quan được gói trong 1 class duy nhất, thay vì rải biến/hàm rời ở
 * global scope.
 */
class AppShell {
  static VIEW_TITLES = {
    dashboard:  "Trang chủ",
    schedule:   "Lịch học",
    gpa:        "Điểm số & GPA",
    curriculum: "Lộ trình học vượt",
    notes:      "Ghi chú",
    ocr:        "Quét ảnh (AI OCR)",
    chatbot:    "Trợ lý AI",
    profile:    "Thông tin cá nhân",
  };

  constructor() {
    this._remindedIds = new Set();
    this._reminderTimer = null;
  }

  async start() {
    if (!AuthHelper.requireAuth()) return;

    let user = AuthHelper.getCurrentUser();
    if (!user) {
      try {
        user = await API.me();
        AuthHelper.setCurrentUser(user);
      } catch (e) {
        location.href = "/pages/login.html";
        return;
      }
    }

    this._renderUserBox(user);
    this._bindGlobalEvents();
    this._startReminderLoop();

    const initialView = (location.hash || "#dashboard").replace("#", "") || "dashboard";
    this.navigateTo(initialView);
  }

  _renderUserBox(user) {
    const u = user || AuthHelper.getCurrentUser();
    if (!u) return;
    document.getElementById("userName").textContent = u.full_name;
    document.getElementById("userEmail").textContent = u.email;
    const avatar = document.getElementById("userAvatar");
    if (u.avatar_url) {
      avatar.innerHTML = `<img src="${u.avatar_url}" alt="${Formatter.escapeHtml(u.full_name)}">`;
    } else {
      avatar.textContent = (u.full_name || "U").charAt(0).toUpperCase();
    }
  }

  _bindGlobalEvents() {
    document.getElementById("topbarToggle")?.addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("open");
    });
    document.getElementById("btnLogout").addEventListener("click", () => {
      Modal.confirm("Bạn có chắc muốn đăng xuất?", "Xác nhận đăng xuất")
        .then(ok => { if (ok) AuthHelper.logout(); });
    });
    document.querySelectorAll(".sidebar-link[data-view]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        this.navigateTo(link.dataset.view);
      });
    });
  }

  /**
   * Chuyển sang 1 view theo tên. Mỗi view-class tự đăng ký vào VIEWS
   * (xem base_view.js) — AppShell không cần biết view cụ thể là class
   * gì, chỉ gọi đúng interface (Polymorphism).
   */
  navigateTo(view) {
    if (!window.VIEWS[view]) view = "dashboard";

    history.replaceState(null, "", "#" + view);
    document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
    document.querySelector(`.sidebar-link[data-view="${view}"]`)?.classList.add("active");
    document.getElementById("pageTitle").textContent = AppShell.VIEW_TITLES[view] || "";
    document.getElementById("sidebar").classList.remove("open");

    const container = document.getElementById("content");
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div class="spinner spinner-lg"></div></div>`;

    Promise.resolve(window.VIEWS[view](container)).catch(err => {
      container.innerHTML = `<div class="alert alert-danger">Lỗi tải view: ${Formatter.escapeHtml(err.message || String(err))}</div>`;
    });
  }

  _startReminderLoop() {
    this._reminderTimer = setInterval(() => this._checkReminders(), 60000);
    setTimeout(() => this._checkReminders(), 3000);
  }

  async _checkReminders() {
    try {
      const upcoming = await API.getUpcomingSchedules();
      const now = new Date();
      for (const cls of upcoming) {
        const reminderAt = new Date(cls.reminder_at);
        const classAt = new Date(cls.next_class_at);
        const dedupeKey = cls.id + "-" + classAt.toDateString();
        if (reminderAt <= now && classAt > now && !this._remindedIds.has(dedupeKey)) {
          this._remindedIds.add(dedupeKey);
          this._showClassReminder(cls);
        }
      }
    } catch (e) { /* ignore lỗi mạng tạm thời */ }
  }

  _showClassReminder(cls) {
    Toast.show(
      `${cls.subject_name} - Phòng ${cls.room || "N/A"} - ${cls.start_time} (còn ${cls.minutes_until} phút)`,
      "warning", "Sắp đến giờ học", 8000
    );
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification("Sắp đến giờ học - TLU", {
        body: `${cls.subject_name}\nPhòng ${cls.room || "?"} - Bắt đầu ${cls.start_time}`,
      });
    } else if ("Notification" in window && Notification.permission !== "denied") {
      Notification.requestPermission();
    }
  }
}

window.AppShell = AppShell;
window.VIEWS = window.VIEWS || {};
window.appShell = new AppShell();
window.navigateTo = (view) => window.appShell.navigateTo(view);
window.renderUserBox = () => window.appShell._renderUserBox();

window.appShell.start();
