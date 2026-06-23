/**
 * ProfileView - Thông tin cá nhân (Use Case 3.3).
 */
class ProfileView extends BaseView {
  async render() {
    this.user = await API.getProfile();
    this.setHTML(this._buildHTML());
    this._bindEvents();
  }

  _buildHTML() {
    const u = this.user;
    return `
      <div class="page-header">
        <div>
          <h1>Thông tin cá nhân</h1>
          <p>Quản lý thông tin tài khoản và bảo mật</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="card" style="text-align:center;padding:32px">
          <div style="position:relative;width:120px;height:120px;margin:0 auto 16px">
            <div id="avatarBox" style="width:120px;height:120px;border-radius:50%;background:var(--tlu-primary);color:white;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;overflow:hidden">
              ${u.avatar_url
                ? `<img src="${u.avatar_url}" style="width:100%;height:100%;object-fit:cover" alt="">`
                : (u.full_name || "U").charAt(0).toUpperCase()
              }
            </div>
            <button class="btn btn-primary btn-icon" style="position:absolute;bottom:0;right:0;border-radius:50%;width:36px;height:36px" id="btnUploadAvatar" title="Đổi ảnh đại diện">+</button>
            <input type="file" id="avatarInput" accept="image/jpeg,image/png,image/webp" style="display:none">
          </div>
          <h2 style="margin-bottom:4px">${Formatter.escapeHtml(u.full_name)}</h2>
          <p class="text-muted">${Formatter.escapeHtml(u.email)}</p>
          <div style="margin-top:12px">
            <span class="badge ${u.role === 'admin' ? 'badge-danger' : 'badge-primary'}">${u.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}</span>
            ${u.is_active ? '<span class="badge badge-success">Đang hoạt động</span>' : '<span class="badge badge-danger">Đã khóa</span>'}
          </div>
          <hr style="margin:24px 0;border:none;border-top:1px solid var(--border-light)">
          <button class="btn btn-warning btn-block" id="btnChangePassword">Đổi mật khẩu</button>
        </div>

        <div class="card">
          <div class="card-header"><h3 class="card-title">Cập nhật thông tin</h3></div>
          <form id="profileForm">
            <div class="form-group">
              <label class="form-label">Email</label>
              <input class="form-control" value="${Formatter.escapeHtml(u.email)}" disabled>
              <p class="form-help">Email không thể thay đổi</p>
            </div>
            <div class="form-group">
              <label class="form-label">Họ và tên <span class="required">*</span></label>
              <input name="full_name" class="form-control" value="${Formatter.escapeHtml(u.full_name || "")}" required>
            </div>
            <div class="form-group">
              <label class="form-label">Mã sinh viên</label>
              <input name="student_code" class="form-control" value="${Formatter.escapeHtml(u.student_code || "")}" placeholder="VD: 2151234567">
            </div>
            <div class="auth-form-row">
              <div class="form-group">
                <label class="form-label">Khóa</label>
                <input name="course" class="form-control" value="${Formatter.escapeHtml(u.course || "")}" placeholder="K65">
              </div>
              <div class="form-group">
                <label class="form-label">Lớp</label>
                <input name="class_name" class="form-control" value="${Formatter.escapeHtml(u.class_name || "")}" placeholder="65CNTT01">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Ngành học</label>
              <input name="major" class="form-control" value="${Formatter.escapeHtml(u.major || "")}">
            </div>
            <div class="form-group">
              <label class="form-label">Số điện thoại</label>
              <input name="phone" class="form-control" value="${Formatter.escapeHtml(u.phone || "")}" placeholder="0901234567">
            </div>
            <button type="submit" class="btn btn-primary">Lưu thay đổi</button>
          </form>
        </div>
      </div>
    `;
  }

  _bindEvents() {
    this.$("#profileForm").onsubmit = (e) => this._saveProfile(e);
    this.$("#btnUploadAvatar").onclick = () => this.$("#avatarInput").click();
    this.$("#avatarInput").onchange = (e) => this._uploadAvatar(e);
    this.$("#btnChangePassword").onclick = () => this._openChangePasswordModal();
  }

  async _saveProfile(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    const data = {
      full_name: fd.get("full_name")?.trim(),
      student_code: fd.get("student_code")?.trim() || null,
      course: fd.get("course")?.trim() || null,
      class_name: fd.get("class_name")?.trim() || null,
      major: fd.get("major")?.trim() || null,
      phone: fd.get("phone")?.trim() || null,
    };
    try {
      const updated = await API.updateProfile(data);
      AuthHelper.setCurrentUser(updated);
      Toast.success("Đã cập nhật thông tin");
      window.appShell._renderUserBox(updated);
    } catch (err) {
      Toast.error(err.message);
    }
  }

  async _uploadAvatar(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { Toast.error("Ảnh không được lớn hơn 5MB"); return; }
    try {
      await API.uploadAvatar(file);
      Toast.success("Đã cập nhật ảnh đại diện");
      const u = await API.getProfile();
      AuthHelper.setCurrentUser(u);
      navigateTo("profile");
      window.appShell._renderUserBox(u);
    } catch (err) {
      Toast.error(err.message);
    }
  }

  _openChangePasswordModal() {
    const formEl = document.createElement("form");
    formEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Mật khẩu hiện tại <span class="required">*</span></label>
        <input type="password" name="current_password" class="form-control" required>
      </div>
      <div class="form-group">
        <label class="form-label">Mật khẩu mới <span class="required">*</span></label>
        <input type="password" name="new_password" class="form-control" required minlength="8">
        <p class="form-help">Tối thiểu 8 ký tự, gồm chữ và số</p>
      </div>
      <div class="form-group">
        <label class="form-label">Xác nhận mật khẩu mới <span class="required">*</span></label>
        <input type="password" name="confirm" class="form-control" required minlength="8">
      </div>
    `;
    const footer = document.createElement("div");
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Hủy</button>
      <button type="button" class="btn btn-primary" data-action="save">Đổi mật khẩu</button>
    `;
    const modal = Modal.show({ title: "Đổi mật khẩu", body: formEl, footer });
    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = () => this._submitChangePassword(formEl, modal);
  }

  async _submitChangePassword(formEl, modal) {
    const fd = new FormData(formEl);
    const newPw = fd.get("new_password");
    const confirm = fd.get("confirm");
    if (newPw !== confirm) { Toast.error("Mật khẩu xác nhận không khớp"); return; }
    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(newPw)) {
      Toast.error("Mật khẩu mới phải bao gồm cả chữ và số");
      return;
    }
    try {
      await API.changePassword({
        old_password: fd.get("current_password"),
        new_password: newPw,
      });
      Toast.success("Đã đổi mật khẩu thành công");
      modal.close();
    } catch (err) {
      Toast.error(err.message);
    }
  }
}

BaseView.register("profile", ProfileView);
