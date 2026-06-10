/**
 * Dashboard View - Trang tổng quan
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.dashboard = async function(container) {
  const user = getCurrentUser();
  const [gpa, schedules, upcoming, notes] = await Promise.all([
    API.getGPA().catch(() => ({})),
    API.getSchedules().catch(() => []),
    API.getUpcomingSchedules().catch(() => []),
    API.getNotes().catch(() => []),
  ]);

  const gpa4 = gpa.gpa_4 || 0;
  const gpa10 = gpa.gpa_10 || 0;
  const credits = gpa.earned_credits || 0;
  const totalCredits = gpa.total_credits || 0;
  const classification = gpa.classification || "Chưa có dữ liệu";
  const completed = gpa.completed_subjects || 0;
  const failed = gpa.failed_subjects || 0;

  const nextClass = upcoming[0];

  container.innerHTML = `
    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon"></div>
        <div class="stat-label">GPA hệ 4</div>
        <div class="stat-value">${gpa4.toFixed(2)}</div>
        <div class="stat-change">${classification}</div>
      </div>
      <div class="stat-card success">
        <div class="stat-icon"></div>
        <div class="stat-label">GPA hệ 10</div>
        <div class="stat-value">${gpa10.toFixed(2)}</div>
        <div class="stat-change">${completed} môn đã đạt</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-icon"></div>
        <div class="stat-label">Tín chỉ tích lũy</div>
        <div class="stat-value">${credits}</div>
        <div class="stat-change">/ ${totalCredits} đã đăng ký</div>
      </div>
      <div class="stat-card ${failed > 0 ? 'danger' : 'success'}">
        <div class="stat-icon"></div>
        <div class="stat-label">Lịch học</div>
        <div class="stat-value">${schedules.length}</div>
        <div class="stat-change">${schedules.length} buổi/tuần</div>
      </div>
    </div>

    <div class="grid-2">
      <!-- Lịch sắp tới -->
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Lịch học sắp tới</h3>
          <button class="btn btn-ghost btn-sm" onclick="navigateTo('schedule')">Xem tất cả →</button>
        </div>
        <div id="upcomingClasses">
          ${upcoming.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon"></div><p class="text-muted">Không có lịch học trong 24h tới</p></div>`
            : upcoming.slice(0, 5).map(c => `
                <div style="display:flex;gap:14px;padding:12px;border-radius:var(--radius);background:var(--bg-hover);margin-bottom:8px;align-items:center">
                  <div style="width:50px;text-align:center;padding:8px;background:var(--tlu-primary);color:white;border-radius:var(--radius-sm)">
                    <div style="font-size:11px;font-weight:600;opacity:0.85">${dayName(new Date(c.next_class_at).getDay() === 0 ? 8 : new Date(c.next_class_at).getDay() + 1)}</div>
                    <div style="font-size:16px;font-weight:800">${c.start_time}</div>
                  </div>
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:700;color:var(--text-primary)">${escapeHtml(c.subject_name)}</div>
                    <div class="text-sm text-muted">${c.room ? "Phòng " + escapeHtml(c.room) : ""} ${c.teacher ? "· " + escapeHtml(c.teacher) : ""}</div>
                  </div>
                  <span class="badge ${c.minutes_until <= 60 ? 'badge-warning' : 'badge-primary'}">${c.minutes_until <= 60 ? c.minutes_until + " phút" : Math.round(c.minutes_until/60) + " giờ"}</span>
                </div>
              `).join('')}
        </div>
      </div>

      <!-- Quick actions / Recent notes -->
      <div>
        <div class="card mb-4">
          <div class="card-header">
            <h3 class="card-title">Truy cập nhanh</h3>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <button class="btn btn-secondary" onclick="navigateTo('schedule')">Lịch học</button>
            <button class="btn btn-secondary" onclick="navigateTo('gpa')">📊 Điểm số</button>
            <button class="btn btn-secondary" onclick="navigateTo('notes')">Ghi chú</button>
            <button class="btn btn-secondary" onclick="navigateTo('curriculum')">🎓 Học vượt</button>
            <button class="btn btn-secondary" onclick="navigateTo('ocr')">Quét ảnh</button>
            <button class="btn btn-secondary" onclick="navigateTo('chatbot')">🤖 AI Chat</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <h3 class="card-title">Ghi chú gần đây</h3>
            <button class="btn btn-ghost btn-sm" onclick="navigateTo('notes')">Xem tất cả →</button>
          </div>
          ${notes.length === 0
            ? `<div class="empty-state"><div class="empty-state-icon"></div><p class="text-muted text-sm">Chưa có ghi chú nào</p></div>`
            : notes.slice(0, 3).map(n => `
                <div style="padding:10px;border-radius:var(--radius);background:${n.color || '#FFF9C4'};margin-bottom:8px;cursor:pointer" onclick="navigateTo('notes')">
                  <div style="font-weight:700;font-size:13px;color:var(--text-primary)">${escapeHtml(n.title)} ${n.is_pinned ? '📌' : ''}</div>
                  <div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:2px">${escapeHtml(n.content)}</div>
                  <div class="text-sm text-muted" style="margin-top:4px;font-size:11px">${timeAgo(n.updated_at)}</div>
                </div>
              `).join('')}
        </div>
      </div>
    </div>

    <!-- Bảng tiến độ học tập -->
    ${gpa.by_semester && gpa.by_semester.length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">Tiến độ học tập theo học kỳ</h3>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Học kỳ</th><th>Số môn</th><th>Tín chỉ</th><th>GPA hệ 10</th><th>GPA hệ 4</th></tr></thead>
            <tbody>
              ${gpa.by_semester.map(s => `
                <tr>
                  <td><b>${escapeHtml(s.semester)}</b></td>
                  <td>${s.subjects_count}</td>
                  <td>${s.credits}</td>
                  <td>${s.gpa_10.toFixed(2)}</td>
                  <td><b style="color:var(--tlu-primary)">${s.gpa_4.toFixed(2)}</b></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}
  `;
};
