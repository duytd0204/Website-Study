/**
 * Main App Logic - Sidebar routing & shell
 * Đăng ký các view module và xử lý routing đơn giản
 */

// Bảo vệ route
if (!requireAuth()) {
  // Đã chuyển hướng
} else {

(async function init() {
  const user = getCurrentUser();
  if (!user) {
    try {
      const me = await API.me();
      setCurrentUser(me);
    } catch (e) {
      location.href = "/pages/login.html";
      return;
    }
  }

  // Render thông tin user trên sidebar
  renderUserBox();

  // Sidebar toggle (mobile)
  document.getElementById("topbarToggle")?.addEventListener("click", () => {
    document.getElementById("sidebar").classList.toggle("open");
  });

  // Logout
  document.getElementById("btnLogout").addEventListener("click", () => {
    Modal.confirm("Bạn có chắc muốn đăng xuất?", "Xác nhận đăng xuất")
      .then(ok => { if (ok) doLogout(); });
  });

  // Sidebar navigation
  document.querySelectorAll(".sidebar-link[data-view]").forEach(link => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const view = link.dataset.view;
      navigateTo(view);
    });
  });

  // Check reminder mỗi phút
  setInterval(checkReminders, 60000);
  setTimeout(checkReminders, 3000);

  // Khởi tạo route từ hash
  const initialView = (location.hash || "#dashboard").replace("#", "") || "dashboard";
  navigateTo(initialView);
})();


function renderUserBox() {
  const u = getCurrentUser();
  if (!u) return;
  document.getElementById("userName").textContent = u.full_name;
  document.getElementById("userEmail").textContent = u.email;
  const avatar = document.getElementById("userAvatar");
  if (u.avatar_url) {
    avatar.innerHTML = `<img src="${u.avatar_url}" alt="${escapeHtml(u.full_name)}">`;
  } else {
    avatar.textContent = (u.full_name || "U").charAt(0).toUpperCase();
  }
}
window.renderUserBox = renderUserBox;


const VIEW_TITLES = {
  dashboard: "Trang chủ",
  schedule: "Lịch học",
  gpa: "Điểm số & GPA",
  curriculum: "Lộ trình học vượt",
  notes: "Ghi chú",
  ocr: "Quét ảnh (AI OCR)",
  chatbot: "Trợ lý AI",
  profile: "Thông tin cá nhân",
};

function navigateTo(view) {
  if (!VIEWS[view]) view = "dashboard";

  // Update URL
  history.replaceState(null, "", "#" + view);

  // Update sidebar active state
  document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
  const link = document.querySelector(`.sidebar-link[data-view="${view}"]`);
  if (link) link.classList.add("active");

  // Update title
  document.getElementById("pageTitle").textContent = VIEW_TITLES[view] || "";

  // Close sidebar (mobile)
  document.getElementById("sidebar").classList.remove("open");

  // Render view
  const container = document.getElementById("content");
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div class="spinner spinner-lg"></div></div>`;
  Promise.resolve(VIEWS[view](container)).catch(err => {
    container.innerHTML = `<div class="alert alert-danger">Lỗi tải view: ${escapeHtml(err.message || String(err))}</div>`;
  });
}
window.navigateTo = navigateTo;


// Mỗi view module phải đăng ký vào VIEWS object
window.VIEWS = window.VIEWS || {};


// ============ REMINDER NOTIFICATIONS ============
const remindedIds = new Set();

async function checkReminders() {
  try {
    const upcoming = await API.getUpcomingSchedules();
    const now = new Date();
    for (const cls of upcoming) {
      const reminderAt = new Date(cls.reminder_at);
      const classAt = new Date(cls.next_class_at);
      if (
        reminderAt <= now &&
        classAt > now &&
        !remindedIds.has(cls.id + "-" + classAt.toDateString())
      ) {
        remindedIds.add(cls.id + "-" + classAt.toDateString());
        showClassReminder(cls);
        document.getElementById("notifDot").classList.remove("hidden");
      }
    }
  } catch (e) { /* ignore */ }
}

function showClassReminder(cls) {
  Toast.show(
    `${cls.subject_name} - Phòng ${cls.room || "N/A"} - ${cls.start_time} (còn ${cls.minutes_until} phút)`,
    "warning",
    "⏰ Sắp đến giờ học",
    8000
  );

  // Browser native notification nếu được phép
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification("⏰ Sắp đến giờ học - TLU", {
      body: `${cls.subject_name}\nPhòng ${cls.room || "?"} - Bắt đầu ${cls.start_time}`,
      icon: "/assets/logo.png",
    });
  } else if ("Notification" in window && Notification.permission !== "denied") {
    Notification.requestPermission();
  }
}

function showNotificationModal(upcoming) {
  document.getElementById("notifDot").classList.add("hidden");
  let body;
  if (!upcoming || upcoming.length === 0) {
    body = `<div class="empty-state"><div class="empty-state-icon">🎉</div><p>Không có lịch học nào sắp diễn ra trong 24h tới.</p></div>`;
  } else {
    body = `<div style="display:flex;flex-direction:column;gap:10px">
      ${upcoming.map(c => `
        <div class="card" style="padding:14px;border-left:3px solid var(--tlu-primary)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start">
            <div>
              <h4 style="margin:0 0 4px">${escapeHtml(c.subject_name)}</h4>
              <p class="text-muted text-sm" style="margin:0">
                🏫 Phòng ${escapeHtml(c.room || "?")} ${c.teacher ? "· 👨‍🏫 " + escapeHtml(c.teacher) : ""}
              </p>
              <p class="text-sm" style="margin:6px 0 0;color:var(--tlu-primary);font-weight:600">
                ${c.start_time} - ${c.end_time}
              </p>
            </div>
            <span class="badge ${c.minutes_until <= 60 ? 'badge-warning' : 'badge-primary'}">
              ${c.minutes_until <= 60 ? c.minutes_until + ' phút nữa' : 'Còn ' + Math.round(c.minutes_until/60) + ' giờ'}
            </span>
          </div>
        </div>
      `).join('')}
    </div>`;
  }
  Modal.show({
    title: "🔔 Lịch học sắp tới",
    body,
    size: "md"
  });
}

}
