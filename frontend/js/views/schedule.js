/**
 * Schedule View - Quản lý lịch học (Use Case 3.5)
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.schedule = async function(container) {
  let schedules = await API.getSchedules();

  // Sắp xếp theo day_of_week rồi giờ bắt đầu
  schedules.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));

  const TIME_SLOTS = [
    "06:00", "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
    "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00"
  ];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>Lịch học</h1>
        <p>Quản lý thời khóa biểu hàng tuần · Nhận nhắc nhở 30 phút trước giờ học</p>
      </div>
      <div class="page-actions">
        <button class="btn btn-secondary" id="btnImportSchedule">Quét từ ảnh</button>
        <button class="btn btn-secondary" id="btnSendReminder">Gửi nhắc qua Gmail</button>
        <button class="btn btn-danger" id="btnClearAll">Xóa toàn bộ</button>
        <button class="btn btn-primary" id="btnAddSchedule">+ Thêm lịch học</button>
      </div>
    </div>

    <!-- Calendar grid -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">Thời khóa biểu tuần</h3>
        <span class="text-muted text-sm">${schedules.length} buổi học</span>
      </div>
      <div id="calendarGrid"></div>
    </div>

    <!-- List view -->
    <div class="card mt-4">
      <div class="card-header">
        <h3 class="card-title">Danh sách chi tiết</h3>
      </div>
      <div id="scheduleList"></div>
    </div>
  `;

  // Render calendar grid
  renderCalendar();
  renderList();

  function renderCalendar() {
    const calendarEl = document.getElementById("calendarGrid");
    const today = new Date().getDay(); // 0=CN, 1=T2,..6=T7
    const todayCol = today === 0 ? 7 : today; // 7=CN, 1-6=T2-T7

    let html = `<div class="calendar">`;
    html += `<div class="calendar-header-cell">Giờ</div>`;
    [2,3,4,5,6,7,8].forEach((d,i) => {
      html += `<div class="calendar-header-cell ${todayCol === i+1 ? 'today' : ''}">${dayName(d)}</div>`;
    });

    // Map môn theo (day, hour)
    const map = {}; // map[day][hour] = [items]
    for (const s of schedules) {
      const day = s.day_of_week;
      const startH = parseInt(s.start_time.split(":")[0]);
      if (!map[day]) map[day] = {};
      if (!map[day][startH]) map[day][startH] = [];
      map[day][startH].push(s);
    }

    for (const time of TIME_SLOTS) {
      const hour = parseInt(time.split(":")[0]);
      html += `<div class="calendar-time-cell">${time}</div>`;
      for (const day of [2,3,4,5,6,7,8]) {
        const items = (map[day] && map[day][hour]) || [];
        html += `<div class="calendar-cell">`;
        for (const item of items) {
          html += `
            <div class="schedule-item" data-id="${item.id}" style="background:${item.color}">
              <div class="name">${escapeHtml(item.subject_name)}</div>
              <div class="meta">${item.start_time.slice(0,5)}-${item.end_time.slice(0,5)} · ${escapeHtml(item.room || "")}</div>
            </div>`;
        }
        html += `</div>`;
      }
    }
    html += `</div>`;
    calendarEl.innerHTML = html;

    calendarEl.querySelectorAll(".schedule-item").forEach(el => {
      el.addEventListener("click", () => editSchedule(parseInt(el.dataset.id)));
    });
  }

  function renderList() {
    const listEl = document.getElementById("scheduleList");
    if (schedules.length === 0) {
      listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"></div><div class="empty-state-title">Chưa có lịch học</div><div class="empty-state-desc">Nhấn "+ Thêm lịch học" để bắt đầu</div></div>`;
      return;
    }
    listEl.innerHTML = `
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Thứ</th><th>Giờ</th><th>Môn học</th><th>Mã môn</th>
              <th>Phòng</th><th>Giảng viên</th><th>Tuần</th><th></th>
            </tr>
          </thead>
          <tbody>
            ${schedules.map(s => `
              <tr>
                <td><span class="badge badge-primary">${dayName(s.day_of_week)}</span></td>
                <td><b>${s.start_time.slice(0,5)}-${s.end_time.slice(0,5)}</b></td>
                <td>
                  <span style="display:inline-block;width:8px;height:8px;background:${s.color};border-radius:50%;margin-right:6px"></span>
                  ${escapeHtml(s.subject_name)}
                </td>
                <td><span class="text-muted">${escapeHtml(s.subject_code || "-")}</span></td>
                <td>${escapeHtml(s.room || "-")}</td>
                <td>${escapeHtml(s.teacher || "-")}</td>
                <td>${escapeHtml(s.weeks || "-")}</td>
                <td>
                  <div style="display:flex;gap:4px">
                    <button class="btn btn-secondary" style="padding:7px 12px;font-size:13px;min-width:70px" data-edit="${s.id}">Sửa</button>
                    <button class="btn btn-danger" style="padding:7px 12px;font-size:13px;min-width:60px;opacity:0.85" data-del="${s.id}">Xóa</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
    listEl.querySelectorAll("[data-edit]").forEach(b =>
      b.addEventListener("click", () => editSchedule(parseInt(b.dataset.edit))));
    listEl.querySelectorAll("[data-del]").forEach(b =>
      b.addEventListener("click", () => deleteSchedule(parseInt(b.dataset.del))));
  }

  function openScheduleModal(item = null) {
    const isEdit = !!item;
    const data = item || {
      subject_name: "", subject_code: "", teacher: "", room: "",
      day_of_week: 2, start_time: "07:00", end_time: "09:25",
      weeks: "1-15", color: "#003F87", reminder_minutes: 30, note: ""
    };

    const formEl = document.createElement("form");
    formEl.id = "scheduleForm";
    formEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tên môn học <span class="required">*</span></label>
        <input name="subject_name" class="form-control" required value="${escapeHtml(data.subject_name)}" placeholder="VD: Cấu trúc dữ liệu và Giải thuật">
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Mã môn</label>
          <input name="subject_code" class="form-control" value="${escapeHtml(data.subject_code || "")}" placeholder="CSE221">
        </div>
        <div class="form-group">
          <label class="form-label">Phòng học</label>
          <input name="room" class="form-control" value="${escapeHtml(data.room || "")}" placeholder="P.201-A2">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Giảng viên</label>
        <input name="teacher" class="form-control" value="${escapeHtml(data.teacher || "")}" placeholder="TS. Nguyễn Văn A">
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Thứ <span class="required">*</span></label>
          <select name="day_of_week" class="form-control" required>
            ${[2,3,4,5,6,7,8].map(d => `<option value="${d}" ${data.day_of_week==d?"selected":""}>${dayName(d)}</option>`).join("")}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tuần học</label>
          <input name="weeks" class="form-control" value="${escapeHtml(data.weeks || "")}" placeholder="1-15 hoặc 1,3,5">
        </div>
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Giờ bắt đầu <span class="required">*</span></label>
          <input type="time" name="start_time" class="form-control" required value="${data.start_time?.slice(0,5) || "07:00"}">
        </div>
        <div class="form-group">
          <label class="form-label">Giờ kết thúc <span class="required">*</span></label>
          <input type="time" name="end_time" class="form-control" required value="${data.end_time?.slice(0,5) || "09:25"}">
        </div>
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Nhắc trước (phút)</label>
          <input type="number" name="reminder_minutes" class="form-control" value="${data.reminder_minutes}" min="0" max="120">
        </div>
        <div class="form-group">
          <label class="form-label">Màu hiển thị</label>
          <input type="color" name="color" class="form-control" value="${data.color}" style="height:42px;padding:4px">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Ghi chú</label>
        <textarea name="note" class="form-control" rows="2" placeholder="Ghi chú thêm...">${escapeHtml(data.note || "")}</textarea>
      </div>
    `;

    const footer = document.createElement("div");
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Hủy</button>
      <button type="button" class="btn btn-primary" data-action="save">💾 ${isEdit ? "Cập nhật" : "Thêm mới"}</button>
    `;

    const modal = Modal.show({
      title: isEdit ? "Chỉnh sửa lịch học" : "+ Thêm lịch học",
      body: formEl,
      footer,
      size: "md"
    });

    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = async () => {
      const fd = new FormData(formEl);
      const payload = {
        subject_name: fd.get("subject_name").trim(),
        subject_code: fd.get("subject_code")?.trim() || null,
        teacher: fd.get("teacher")?.trim() || null,
        room: fd.get("room")?.trim() || null,
        day_of_week: parseInt(fd.get("day_of_week")),
        start_time: fd.get("start_time") + ":00",
        end_time: fd.get("end_time") + ":00",
        weeks: fd.get("weeks")?.trim() || null,
        color: fd.get("color"),
        reminder_minutes: parseInt(fd.get("reminder_minutes")) || 30,
        note: fd.get("note")?.trim() || null,
      };
      if (!payload.subject_name) {
        Toast.error("Vui lòng nhập tên môn học");
        return;
      }
      try {
        if (isEdit) {
          await API.updateSchedule(item.id, payload);
          Toast.success("Đã cập nhật lịch học");
        } else {
          await API.createSchedule(payload);
          Toast.success("Đã thêm lịch học");
        }
        modal.close();
        schedules = await API.getSchedules();
        schedules.sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time));
        renderCalendar();
        renderList();
      } catch (err) {
        Toast.error(err.message);
      }
    };
  }

  function editSchedule(id) {
    const item = schedules.find(s => s.id === id);
    if (item) openScheduleModal(item);
  }

  async function deleteSchedule(id) {
    const item = schedules.find(s => s.id === id);
    if (!item) return;
    const ok = await Modal.confirm(`Xóa lịch học "${item.subject_name}" (${dayName(item.day_of_week)})?`);
    if (!ok) return;
    try {
      await API.deleteSchedule(id);
      Toast.success("Đã xóa lịch học");
      schedules = schedules.filter(s => s.id !== id);
      renderCalendar();
      renderList();
    } catch (err) {
      Toast.error(err.message);
    }
  }

  // Event handlers
  document.getElementById("btnAddSchedule").onclick = () => openScheduleModal();
  document.getElementById("btnSendReminder").onclick = async () => {
    const btn = document.getElementById("btnSendReminder");
    btn.disabled = true; btn.textContent = "Đang gửi...";
    try {
      const r = await API.request("/schedules/remind-email", { method: "POST" });
      if (r && r.sent) Toast.success(`Đã gửi nhắc nhở ${r.count} buổi học qua Gmail`, "Gửi thành công");
      else Toast.info(r?.message || "Không có lịch học nào trong 24h tới");
    } catch(e) { Toast.error(e.message || "Lỗi gửi email"); }
    finally { btn.disabled = false; btn.textContent = "Gửi nhắc qua Gmail"; }
  };
  document.getElementById("btnImportSchedule").onclick = () => navigateTo("ocr");
  document.getElementById("btnClearAll").onclick = async () => {
    if (schedules.length === 0) {
      Toast.warning("Không có lịch học nào để xóa");
      return;
    }
    const ok = await Modal.confirm(`Bạn có chắc muốn XÓA TOÀN BỘ ${schedules.length} buổi học? Hành động này không thể hoàn tác.`, "Xóa tất cả");
    if (!ok) return;
    try {
      await API.deleteAllSchedules();
      Toast.success("Đã xóa toàn bộ lịch học");
      schedules = [];
      renderCalendar();
      renderList();
    } catch (err) {
      Toast.error(err.message);
    }
  };
};
