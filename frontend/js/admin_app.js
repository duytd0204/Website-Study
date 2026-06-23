/**
 * AdminApp - lớp điều khiển khung admin panel (giống AppShell nhưng cho
 * vai trò Quản trị viên). Đăng ký 3 view-class: Overview, Users, Curriculum.
 */
class AdminApp {
  static TITLES = {
    overview:   "Tổng quan hệ thống",
    users:      "Quản lý người dùng",
    curriculum: "Chương trình đào tạo",
  };

  async start() {
    if (!AuthHelper.requireAuth()) return;
    if (!AuthHelper.requireAdmin()) return;

    const u = await API.me();
    AuthHelper.setCurrentUser(u);
    document.getElementById("userName").textContent = u.full_name;
    document.getElementById("userEmail").textContent = u.email;
    document.getElementById("userAvatar").textContent = u.full_name.charAt(0).toUpperCase();

    document.getElementById("btnLogout").onclick = () => {
      Modal.confirm("Đăng xuất khỏi tài khoản admin?").then(ok => { if (ok) AuthHelper.logout(); });
    };
    document.getElementById("topbarToggle").onclick = () => {
      document.getElementById("sidebar").classList.toggle("open");
    };
    document.querySelectorAll(".sidebar-link[data-view]").forEach(l => {
      l.onclick = (e) => { e.preventDefault(); this.navigateTo(l.dataset.view); };
    });

    const initial = (location.hash || "#overview").replace("#", "");
    this.navigateTo(initial);
  }

  navigateTo(view) {
    if (!window.VIEWS[view]) view = "overview";
    history.replaceState(null, "", "#" + view);
    document.querySelectorAll(".sidebar-link").forEach(l => l.classList.remove("active"));
    document.querySelector(`.sidebar-link[data-view="${view}"]`)?.classList.add("active");
    document.getElementById("pageTitle").textContent = AdminApp.TITLES[view] || "";

    const container = document.getElementById("content");
    container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div class="spinner spinner-lg"></div></div>`;

    Promise.resolve(window.VIEWS[view](container)).catch(err => {
      container.innerHTML = `<div class="alert alert-danger">Lỗi: ${Formatter.escapeHtml(err.message)}</div>`;
    });
  }
}

window.VIEWS = window.VIEWS || {};


/** AdminOverviewView - Thống kê tổng quan hệ thống */
class AdminOverviewView extends BaseView {
  async render() {
    const stats = await API.adminStats();
    this.setHTML(`
      <div class="page-header">
        <div>
          <h1>Tổng quan hệ thống</h1>
          <p>Thống kê và giám sát hoạt động của hệ thống</p>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Tổng người dùng</div>
          <div class="stat-value">${stats.total_users}</div>
          <div class="stat-change">+${stats.new_users_7d} trong 7 ngày qua</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Đang hoạt động</div>
          <div class="stat-value">${stats.active_users}</div>
          <div class="stat-change">${stats.locked_users} tài khoản bị khóa</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Sinh viên</div>
          <div class="stat-value">${stats.student_count}</div>
          <div class="stat-change">${stats.admin_count} quản trị viên</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Tin nhắn AI Chat</div>
          <div class="stat-value">${stats.total_chats}</div>
          <div class="stat-change">Đã trao đổi</div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <div class="card-header"><h3 class="card-title">Lịch học</h3></div>
          <div style="font-size:36px;font-weight:800;color:var(--tlu-primary)">${stats.total_schedules}</div>
          <p class="text-muted">Tổng số lịch học đã được tạo</p>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Môn học</h3></div>
          <div style="font-size:36px;font-weight:800;color:var(--success)">${stats.total_subjects}</div>
          <p class="text-muted">Tổng số môn học được theo dõi</p>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Ghi chú</h3></div>
          <div style="font-size:36px;font-weight:800;color:var(--tlu-accent)">${stats.total_notes}</div>
          <p class="text-muted">Tổng số ghi chú đã được tạo</p>
        </div>
      </div>
    `);
  }
}
BaseView.register("overview", AdminOverviewView);


/** AdminUsersView - Quản lý người dùng (tìm, khóa/mở khóa, đổi quyền, reset MK) */
class AdminUsersView extends BaseView {
  constructor(container) {
    super(container);
    this.page = 1;
    this.search = "";
    this.roleFilter = "";
    this.activeFilter = "";
    this._searchTimer = null;
  }

  async render() {
    this.setHTML(`
      <div class="page-header">
        <div>
          <h1>Quản lý người dùng</h1>
          <p>Xem, khóa/mở khóa, đặt lại mật khẩu và phân quyền người dùng</p>
        </div>
      </div>

      <div class="card mb-4">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <input type="text" id="searchU" placeholder="Tìm theo email, họ tên, MSSV..." class="form-control" style="flex:1;min-width:240px">
          <select id="filterRole" class="form-control" style="width:160px">
            <option value="">Tất cả vai trò</option>
            <option value="student">Sinh viên</option>
            <option value="admin">Quản trị viên</option>
          </select>
          <select id="filterActive" class="form-control" style="width:160px">
            <option value="">Tất cả trạng thái</option>
            <option value="true">Đang hoạt động</option>
            <option value="false">Đã khóa</option>
          </select>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Danh sách người dùng</h3>
          <div id="userPagination"></div>
        </div>
        <div id="usersList"></div>
      </div>
    `);

    this.$("#searchU").oninput = (e) => {
      clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.search = e.target.value; this.page = 1; this._load();
      }, 300);
    };
    this.$("#filterRole").onchange = (e) => { this.roleFilter = e.target.value; this.page = 1; this._load(); };
    this.$("#filterActive").onchange = (e) => { this.activeFilter = e.target.value; this.page = 1; this._load(); };

    this._load();
  }

  async _load() {
    const params = { page: this.page, page_size: 20 };
    if (this.search) params.search = this.search;
    if (this.roleFilter) params.role = this.roleFilter;
    if (this.activeFilter) params.is_active = this.activeFilter;
    const data = await API.adminGetUsers(params);
    this._renderTable(data);
  }

  _renderTable(data) {
    const me = AuthHelper.getCurrentUser();
    const listEl = this.$("#usersList");
    if (data.items.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><p class="text-muted">Không có người dùng nào</p></div>`;
    } else {
      listEl.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>ID</th><th>Email</th><th>Họ tên</th><th>MSSV/Mã</th>
                <th>Lớp</th><th>Vai trò</th><th>Trạng thái</th><th>Tạo lúc</th><th></th>
              </tr>
            </thead>
            <tbody>
              ${data.items.map(u => `
                <tr ${u.id === me.id ? 'style="background:var(--info-bg)"' : ''}>
                  <td>${u.id}</td>
                  <td>${Formatter.escapeHtml(u.email)}</td>
                  <td><b>${Formatter.escapeHtml(u.full_name)}</b></td>
                  <td>${Formatter.escapeHtml(u.student_code || "-")}</td>
                  <td>${Formatter.escapeHtml(u.class_name || "-")}</td>
                  <td><span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-primary'}">${u.role === 'admin' ? 'Admin' : 'Sinh viên'}</span></td>
                  <td>${u.is_active ? '<span class="badge badge-success">Hoạt động</span>' : '<span class="badge badge-danger">Đã khóa</span>'}</td>
                  <td class="text-sm text-muted">${Formatter.formatDate(u.created_at)}</td>
                  <td>
                    ${u.id === me.id
                      ? '<span class="text-muted text-sm">(Bạn)</span>'
                      : `
                        <div style="display:flex;gap:2px">
                          <button class="btn btn-ghost btn-sm" data-action="toggle" data-id="${u.id}" title="${u.is_active ? 'Khóa' : 'Mở khóa'}">${u.is_active ? 'Khóa' : 'Mở'}</button>
                          <button class="btn btn-ghost btn-sm" data-action="reset" data-id="${u.id}" title="Đặt lại mật khẩu">Reset MK</button>
                          <button class="btn btn-ghost btn-sm" data-action="role" data-id="${u.id}" title="Đổi vai trò">Đổi quyền</button>
                          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${u.id}" title="Xóa">Xóa</button>
                        </div>
                      `}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `;
      listEl.querySelectorAll("[data-action]").forEach(b => {
        b.onclick = () => this._userAction(b.dataset.action, parseInt(b.dataset.id), data.items.find(x => x.id === parseInt(b.dataset.id)));
      });
    }

    const totalPages = Math.ceil(data.total / data.page_size) || 1;
    this.$("#userPagination").innerHTML = `
      <div style="display:flex;gap:6px;align-items:center;font-size:12px">
        <button class="btn btn-ghost btn-sm" ${this.page <= 1 ? "disabled" : ""} id="prevPage">‹</button>
        <span>${this.page} / ${totalPages} (${data.total} người dùng)</span>
        <button class="btn btn-ghost btn-sm" ${this.page >= totalPages ? "disabled" : ""} id="nextPage">›</button>
      </div>
    `;
    this.$("#prevPage").onclick = () => { if (this.page > 1) { this.page--; this._load(); } };
    this.$("#nextPage").onclick = () => { if (this.page < totalPages) { this.page++; this._load(); } };
  }

  async _userAction(action, id, user) {
    if (action === "toggle") {
      const ok = await Modal.confirm(`${user.is_active ? 'Khóa' : 'Mở khóa'} tài khoản "${user.full_name}"?`);
      if (!ok) return;
      try {
        await API.adminUpdateUser(id, { is_active: !user.is_active });
        Toast.success(user.is_active ? "Đã khóa tài khoản" : "Đã mở khóa tài khoản");
        this._load();
      } catch (err) { Toast.error(err.message); }
    }
    else if (action === "reset") {
      const ok = await Modal.confirm(`Đặt lại mật khẩu cho "${user.full_name}"? Một mật khẩu tạm thời sẽ được tạo.`);
      if (!ok) return;
      try {
        const r = await API.adminResetPassword(id);
        Modal.show({
          title: "Đã đặt lại mật khẩu",
          body: `
            <div class="alert alert-warning">
              <p><b>Mật khẩu tạm thời:</b></p>
              <p style="font-family:monospace;font-size:18px;background:white;padding:8px;border-radius:6px;text-align:center">${r.temporary_password}</p>
              <p class="text-sm">${Formatter.escapeHtml(r.note)}</p>
            </div>`,
          footer: '<button class="btn btn-primary" onclick="document.querySelector(\'.modal-close\').click()">OK</button>'
        });
      } catch (err) { Toast.error(err.message); }
    }
    else if (action === "role") {
      const ok = await Modal.confirm(`Thay đổi vai trò "${user.full_name}" từ ${user.role} → ${user.role === 'admin' ? 'student' : 'admin'}?`);
      if (!ok) return;
      try {
        await API.adminUpdateUser(id, { role: user.role === "admin" ? "student" : "admin" });
        Toast.success("Đã cập nhật vai trò");
        this._load();
      } catch (err) { Toast.error(err.message); }
    }
    else if (action === "delete") {
      const ok = await Modal.confirm(`XÓA VĨNH VIỄN tài khoản "${user.full_name}"? Tất cả dữ liệu của họ cũng sẽ bị xóa. Không thể hoàn tác!`);
      if (!ok) return;
      try {
        await API.adminDeleteUser(id);
        Toast.success("Đã xóa người dùng");
        this._load();
      } catch (err) { Toast.error(err.message); }
    }
  }
}
BaseView.register("users", AdminUsersView);


/** AdminCurriculumView - Quản lý chương trình đào tạo (CRUD môn học) */
class AdminCurriculumView extends BaseView {
  async render() {
    this.items = await API.adminGetCurriculum();
    this.items.sort((a, b) => (a.semester_default || 99) - (b.semester_default || 99));
    this._renderPage();
  }

  _renderPage() {
    this.setHTML(`
      <div class="page-header">
        <div>
          <h1>Chương trình đào tạo</h1>
          <p>Quản lý danh sách môn học trong chương trình đào tạo (dùng cho gợi ý học vượt)</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btnAddCur">+ Thêm môn</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h3 class="card-title">Danh sách môn (${this.items.length})</h3></div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Mã</th><th>Tên môn</th><th>TC</th><th>Kỳ</th><th>Ngành</th><th>Tiên quyết</th><th>Bắt buộc</th><th></th></tr>
            </thead>
            <tbody>
              ${this.items.map(it => `
                <tr>
                  <td><code>${Formatter.escapeHtml(it.subject_code)}</code></td>
                  <td>${Formatter.escapeHtml(it.subject_name)}</td>
                  <td><span class="badge badge-primary">${it.credits}</span></td>
                  <td>${it.semester_default || "-"}</td>
                  <td>${Formatter.escapeHtml(it.major || "-")}</td>
                  <td>${it.prerequisites ? `<span class="text-sm">${Formatter.escapeHtml(it.prerequisites)}</span>` : '<span class="text-muted">-</span>'}</td>
                  <td>${it.is_required ? '<span class="badge badge-success">Bắt buộc</span>' : '<span class="badge badge-secondary">Tự chọn</span>'}</td>
                  <td>
                    <button class="btn btn-ghost btn-sm" data-edit="${it.id}">Sửa</button>
                    <button class="btn btn-ghost btn-sm" data-del="${it.id}">Xóa</button>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `);

    this.$all("[data-edit]").forEach(b =>
      b.onclick = () => this._openEditModal(this.items.find(i => i.id === parseInt(b.dataset.edit))));
    this.$all("[data-del]").forEach(b =>
      b.onclick = () => this._deleteCurriculum(parseInt(b.dataset.del)));
    this.$("#btnAddCur").onclick = () => this._openEditModal(null);
  }

  _openEditModal(item) {
    const isEdit = !!item;
    const data = item || { subject_code: "", subject_name: "", credits: 3, semester_default: 1, major: "Công nghệ thông tin", prerequisites: "", is_required: true };
    const formEl = document.createElement("form");
    formEl.innerHTML = `
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Mã môn <span class="required">*</span></label>
          <input name="subject_code" class="form-control" required value="${Formatter.escapeHtml(data.subject_code)}" placeholder="CSE221">
        </div>
        <div class="form-group">
          <label class="form-label">Tín chỉ <span class="required">*</span></label>
          <input type="number" name="credits" class="form-control" min="1" max="20" required value="${data.credits}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tên môn <span class="required">*</span></label>
        <input name="subject_name" class="form-control" required value="${Formatter.escapeHtml(data.subject_name)}">
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Kỳ học mặc định</label>
          <input type="number" name="semester_default" class="form-control" min="1" max="10" value="${data.semester_default || ""}">
        </div>
        <div class="form-group">
          <label class="form-label">Ngành</label>
          <input name="major" class="form-control" value="${Formatter.escapeHtml(data.major || "")}">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Môn tiên quyết</label>
        <input name="prerequisites" class="form-control" value="${Formatter.escapeHtml(data.prerequisites || "")}" placeholder="VD: CSE121,MTH102">
        <p class="form-help">Nhập danh sách mã môn tiên quyết, cách nhau bằng dấu phẩy</p>
      </div>
      <label class="checkbox">
        <input type="checkbox" name="is_required" ${data.is_required ? "checked" : ""}>
        <span>Là môn bắt buộc</span>
      </label>
    `;
    const footer = document.createElement("div");
    footer.innerHTML = `
      <button class="btn btn-secondary" data-action="cancel">Hủy</button>
      <button class="btn btn-primary" data-action="save">${isEdit ? "Cập nhật" : "Thêm"}</button>
    `;
    const modal = Modal.show({ title: isEdit ? "Sửa môn" : "+ Thêm môn", body: formEl, footer });
    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = () => this._saveCurriculum(formEl, modal, item);
  }

  async _saveCurriculum(formEl, modal, item) {
    const isEdit = !!item;
    const fd = new FormData(formEl);
    const payload = {
      subject_code: fd.get("subject_code").trim().toUpperCase(),
      subject_name: fd.get("subject_name").trim(),
      credits: parseInt(fd.get("credits")) || 3,
      semester_default: fd.get("semester_default") ? parseInt(fd.get("semester_default")) : null,
      major: fd.get("major")?.trim() || null,
      prerequisites: fd.get("prerequisites")?.trim() || null,
      is_required: fd.get("is_required") === "on",
    };
    try {
      if (isEdit) await API.adminUpdateCurriculum(item.id, payload);
      else await API.adminCreateCurriculum(payload);
      Toast.success(isEdit ? "Đã cập nhật" : "Đã thêm môn");
      modal.close();
      this.render();
    } catch (err) { Toast.error(err.message); }
  }

  async _deleteCurriculum(id) {
    const item = this.items.find(i => i.id === id);
    const ok = await Modal.confirm(`Xóa môn "${item.subject_name}" khỏi chương trình đào tạo?`);
    if (!ok) return;
    try {
      await API.adminDeleteCurriculum(id);
      Toast.success("Đã xóa");
      this.render();
    } catch (err) { Toast.error(err.message); }
  }
}
BaseView.register("curriculum", AdminCurriculumView);


window.adminApp = new AdminApp();
window.adminApp.start();
