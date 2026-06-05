/**
 * Curriculum / Advanced Study View - Đề xuất học vượt (Use Case 3.10)
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.curriculum = async function(container) {
  container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div class="spinner spinner-lg"></div></div>`;

  let data;
  try {
    data = await API.recommendAdvanced();
  } catch (err) {
    container.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
    return;
  }

  const canTake = data.can_take || [];
  const cannotTake = data.cannot_take || [];

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>🎓 Lộ trình học vượt</h1>
        <p>Đề xuất các môn bạn có thể đăng ký học vượt dựa trên môn tiên quyết đã hoàn thành</p>
      </div>
    </div>

    <!-- Recommendation banner -->
    <div class="alert alert-info" style="font-size:14px;line-height:1.6">
      ${escapeHtml(data.recommendation_message)}
    </div>

    <!-- Stats -->
    <div class="stats-grid">
      <div class="stat-card success">
        <div class="stat-icon">✓</div>
        <div class="stat-label">Có thể học vượt</div>
        <div class="stat-value">${canTake.length}</div>
        <div class="stat-change">${data.total_available_credits} tín chỉ</div>
      </div>
      <div class="stat-card warning">
        <div class="stat-icon">⏳</div>
        <div class="stat-label">Chưa đủ điều kiện</div>
        <div class="stat-value">${cannotTake.length}</div>
        <div class="stat-change">Cần học môn tiên quyết</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-label">Tổng môn CT đào tạo</div>
        <div class="stat-value">${canTake.length + cannotTake.length}</div>
        <div class="stat-change">Trong chương trình</div>
      </div>
      <div class="stat-card accent">
        <div class="stat-icon">⚠</div>
        <div class="stat-label">Tối đa TLU cho phép</div>
        <div class="stat-value">24</div>
        <div class="stat-change">tín chỉ / kỳ</div>
      </div>
    </div>

    <!-- Có thể học vượt -->
    <div class="card">
      <div class="card-header">
        <h3 class="card-title">✅ Môn có thể đăng ký học vượt</h3>
        <span class="badge badge-success">${canTake.length} môn</span>
      </div>
      ${canTake.length === 0
        ? `<div class="empty-state"><div class="empty-state-icon">📭</div><p class="text-muted">Bạn cần hoàn thành các môn tiên quyết trước</p></div>`
        : `<div class="table-wrap">
            <table class="table">
              <thead>
                <tr>
                  <th>Mã môn</th><th>Tên môn</th><th>TC</th><th>Kỳ gốc</th><th>Tiên quyết</th>
                </tr>
              </thead>
              <tbody>
                ${canTake.map(s => `
                  <tr>
                    <td><code>${escapeHtml(s.subject_code)}</code></td>
                    <td><b>${escapeHtml(s.subject_name)}</b></td>
                    <td><span class="badge badge-primary">${s.credits} TC</span></td>
                    <td>${s.semester_default ? "Kỳ " + s.semester_default : "-"}</td>
                    <td>${s.prerequisites ? `<span class="text-muted text-sm">${escapeHtml(s.prerequisites)}</span>` : '<span class="text-success text-sm">Không yêu cầu</span>'}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>`
      }
    </div>

    <!-- Chưa đủ điều kiện -->
    ${cannotTake.length > 0 ? `
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">⏳ Môn chưa đủ điều kiện</h3>
          <span class="badge badge-warning">${cannotTake.length} môn</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Mã môn</th><th>Tên môn</th><th>TC</th><th>Tiên quyết còn thiếu</th>
              </tr>
            </thead>
            <tbody>
              ${cannotTake.map(s => `
                <tr>
                  <td><code>${escapeHtml(s.subject_code)}</code></td>
                  <td>${escapeHtml(s.subject_name)}</td>
                  <td><span class="badge badge-secondary">${s.credits} TC</span></td>
                  <td><span class="badge badge-danger" style="font-size:10px">${escapeHtml((s.missing_prerequisites || []).join(", ") || s.prerequisites || "-")}</span></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : ''}

    <div class="alert alert-warning mt-4">
      <div>
        <b>📌 Lưu ý quan trọng:</b><br>
        ${escapeHtml(data.max_credits_warning || "Tổng số tín chỉ mỗi học kỳ không vượt quá 24 TC theo quy chế TLU.")}
      </div>
    </div>
  `;
};
