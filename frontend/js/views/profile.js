/**
 * Profile View - Thông tin cá nhân (Use Case 3.3)
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.profile = async function(container) {
  const user = await API.getProfile();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>👤 Thông tin cá nhân</h1>
        <p>Quản lý thông tin tài khoản và bảo mật</p>
      </div>
    </div>

    <div class="grid-2">
      <!-- Avatar + Quick info -->
      <div class="card" style="text-align:center;padding:32px">
        <div style="position:relative;width:120px;height:120px;margin:0 auto 16px">
          <div id="avatarBox" style="width:120px;height:120px;border-radius:50%;background:var(--tlu-primary);color:white;display:flex;align-items:center;justify-content:center;font-size:48px;font-weight:700;overflow:hidden">
            ${user.avatar_url
              ? `<img src="${user.avatar_url}" style="width:100%;height:100%;object-fit:cover" alt="">`
              : (user.full_name || "U").charAt(0).toUpperCase()
            }
          </div>
          <button class="btn btn-primary btn-icon" style="position:absolute;bottom:0;right:0;border-radius:50%;width:36px;height:36px" id="btnUploadAvatar" title="Đổi ảnh đại diện">📷</button>
          <input type="file" id="avatarInput" accept="image/jpeg,image/png,image/webp" style="display:none">
        </div>
        <h2 style="margin-bottom:4px">${escapeHtml(user.full_name)}</h2>
        <p class="text-muted">${escapeHtml(user.email)}</p>
        <div style="margin-top:12px">
          <span class="badge ${user.role === 'admin' ? 'badge-danger' : 'badge-primary'}">${user.role === 'admin' ? 'Quản trị viên' : 'Sinh viên'}</span>
          ${user.is_active ? '<span class="badge badge-success">Đang hoạt động</span>' : '<span class="badge badge-danger">Đã khóa</span>'}
        </div>
        <hr style="margin:24px 0;border:none;border-top:1px solid var(--border-light)">
        <button class="btn btn-warning btn-block" id="btnChangePassword">🔒 Đổi mật khẩu</button>
      </div>

      <!-- Edit form -->
      <div class="card">
        <div class="card-header"><h3 class="card-title">Cập nhật thông tin</h3></div>
        <form id="profileForm">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input class="form-control" value="${escapeHtml(user.email)}" disabled>
            <p class="form-help">Email không thể thay đổi</p>
          </div>
          <div class="form-group">
            <label class="form-label">Họ và tên <span class="required">*</span></label>
            <input name="full_name" class="form-control" value="${escapeHtml(user.full_name || "")}" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mã sinh viên</label>
            <input name="student_code" class="form-control" value="${escapeHtml(user.student_code || "")}" placeholder="VD: 2151234567">
          </div>
          <div class="auth-form-row">
            <div class="form-group">
              <label class="form-label">Khóa</label>
              <input name="course" class="form-control" value="${escapeHtml(user.course || "")}" placeholder="K65">
            </div>
            <div class="form-group">
              <label class="form-label">Lớp</label>
              <input name="class_name" class="form-control" value="${escapeHtml(user.class_name || "")}" placeholder="65CNTT01">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Ngành học</label>
            <input name="major" class="form-control" value="${escapeHtml(user.major || "")}">
          </div>
          <div class="form-group">
            <label class="form-label">Số điện thoại</label>
            <input name="phone" class="form-control" value="${escapeHtml(user.phone || "")}" placeholder="0901234567">
          </div>
          <button type="submit" class="btn btn-primary">💾 Lưu thay đổi</button>
        </form>
      </div>
    </div>
  `;

  // Form submit
  document.getElementById("profileForm").onsubmit = async (e) => {
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
      setCurrentUser(updated);
      Toast.success("Đã cập nhật thông tin");
      renderUserBox();
    } catch (err) {
      Toast.error(err.message);
    }
  };

  // Upload avatar
  document.getElementById("btnUploadAvatar").onclick = () => document.getElementById("avatarInput").click();
  document.getElementById("avatarInput").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      Toast.error("Ảnh không được lớn hơn 5MB");
      return;
    }
    try {
      const res = await API.uploadAvatar(file);
      Toast.success("Đã cập nhật ảnh đại diện");
      // Reload profile
      const u = await API.getProfile();
      setCurrentUser(u);
      navigateTo("profile");
      renderUserBox();
    } catch (err) {
      Toast.error(err.message);
    }
  };

  // Change password
  document.getElementById("btnChangePassword").onclick = () => {
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
      <button type="button" class="btn btn-primary" data-action="save">🔒 Đổi mật khẩu</button>
    `;
    const modal = Modal.show({ title: "🔒 Đổi mật khẩu", body: formEl, footer });
    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = async () => {
      const fd = new FormData(formEl);
      const newPw = fd.get("new_password");
      const confirm = fd.get("confirm");
      if (newPw !== confirm) {
        Toast.error("Mật khẩu xác nhận không khớp");
        return;
      }
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
    };
  };
};
