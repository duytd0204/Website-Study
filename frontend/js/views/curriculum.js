/**
 * CurriculumView - Đề xuất lộ trình học vượt (theo đúng Use Case).
 * Luồng chính : xem gợi ý → chọn môn → lưu lộ trình
 * Luồng thay thế: Làm mới / không lưu
 * Luồng ngoại lệ: E01 chưa đủ điều kiện, E02 lỗi dữ liệu quy chế
 */
class CurriculumView extends BaseView {
  constructor(container) {
    super(container);
    this.selected = new Set();
  }

  async render() {
    this.setHTML(`<div style="display:flex;align-items:center;justify-content:center;padding:80px 20px"><div class="spinner spinner-lg"></div></div>`);

    try {
      [this.data, this.savedPlan] = await Promise.all([
        API.recommendAdvanced(),
        API.getStudyPlan().catch(() => []),
      ]);
    } catch (err) {
      this.setHTML(`
        <div class="page-header"><div><h1>Lộ trình học vượt</h1></div></div>
        <div class="alert alert-danger">
          <b>E02 – Lỗi dữ liệu quy chế đào tạo</b><br>
          Dữ liệu quy chế đang được bảo trì, vui lòng thử lại sau.<br>
          <small>${Formatter.escapeHtml(err.message)}</small>
        </div>`);
      return;
    }

    this.selected = new Set(this.savedPlan.map(s => s.subject_code));
    this._renderPage();
  }

  get canTake()    { return this.data.can_take || []; }
  get cannotTake() { return this.data.cannot_take || []; }

  _renderPage() {
    const { data, canTake, cannotTake, savedPlan } = this;

    this.setHTML(`
      <div class="page-header">
        <div>
          <h1>Lộ trình học vượt</h1>
          <p>Đề xuất môn học vượt dựa trên tiên quyết đã hoàn thành · Kỳ hiện tại: <b>Kỳ ${data.current_semester}</b></p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btnRefresh">Làm mới</button>
          ${canTake.length > 0 ? `<button class="btn btn-primary" id="btnSavePlan">Lưu lộ trình</button>` : ''}
        </div>
      </div>

      <div class="alert ${data.error_code === 'E01' ? 'alert-warning' : data.error_code === 'E02' ? 'alert-danger' : 'alert-info'}" style="font-size:14px">
        ${Formatter.escapeHtml(data.recommendation_message)}
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Kỳ hiện tại</div>
          <div class="stat-value">Kỳ ${data.current_semester}</div>
          <div class="stat-change">Đã suy ra từ dữ liệu môn học</div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Có thể học vượt</div>
          <div class="stat-value">${canTake.length}</div>
          <div class="stat-change">${data.total_available_credits} tín chỉ</div>
        </div>
        <div class="stat-card warning">
          <div class="stat-label">Chưa đủ điều kiện</div>
          <div class="stat-value">${cannotTake.length}</div>
          <div class="stat-change">Thiếu môn tiên quyết</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Tối đa / kỳ (TLU)</div>
          <div class="stat-value">${data.max_credits_per_semester}</div>
          <div class="stat-change">tín chỉ</div>
        </div>
      </div>

      ${canTake.length > 0 ? this._canTakeTable() : this._emptyCanTake()}
      ${cannotTake.length > 0 ? this._cannotTakeTable() : ''}
      ${savedPlan.length > 0 ? this._savedPlanTable() : ''}

      <div class="alert alert-warning mt-4">
        <b>Lưu ý:</b> ${Formatter.escapeHtml(data.max_credits_warning)}
      </div>
    `);

    this._bindEvents();
    this._updateCreditSummary();
  }

  _canTakeTable() {
    const { canTake, data, selected } = this;
    return `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Môn có thể đăng ký học vượt</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <span id="selectedCount" class="badge badge-primary">Đã chọn ${selected.size} môn</span>
            <button class="btn btn-secondary btn-sm" id="btnSelectAll">Chọn tất cả</button>
            <button class="btn btn-ghost btn-sm" id="btnClearSel">Bỏ chọn hết</button>
          </div>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th style="width:40px"><input type="checkbox" id="chkAll" style="accent-color:var(--tlu-primary)" title="Chọn tất cả"></th>
                <th>Mã môn</th><th>Tên môn</th><th>TC</th>
                <th>Kỳ gốc</th><th>Học vượt (kỳ)</th><th>Tiên quyết</th>
              </tr>
            </thead>
            <tbody>
              ${canTake.map(s => `
                <tr>
                  <td>
                    <input type="checkbox" class="subj-chk" data-code="${Formatter.escapeHtml(s.subject_code)}"
                      ${selected.has(s.subject_code) ? 'checked' : ''}
                      style="accent-color:var(--tlu-primary);width:16px;height:16px">
                  </td>
                  <td><code>${Formatter.escapeHtml(s.subject_code)}</code></td>
                  <td><b>${Formatter.escapeHtml(s.subject_name)}</b></td>
                  <td><span class="badge badge-primary">${s.credits} TC</span></td>
                  <td>Kỳ ${s.semester_default}</td>
                  <td>
                    <span class="badge ${s.semester_default - data.current_semester === 1 ? 'badge-warning' : 'badge-success'}">
                      Vượt ${s.semester_default - data.current_semester} kỳ
                    </span>
                  </td>
                  <td>${s.prerequisites ? `<span class="text-muted text-sm">${Formatter.escapeHtml(s.prerequisites)}</span>` : '<span class="text-success text-sm">Không yêu cầu</span>'}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
        <div style="padding:12px 0;border-top:1px solid var(--border-light)">
          <div id="creditSummary" class="alert alert-info" style="margin:0;font-size:13px"></div>
        </div>
      </div>`;
  }

  _emptyCanTake() {
    const { data } = this;
    return `
      <div class="card">
        <div class="empty-state">
          <div class="empty-state-title">Chưa có môn học vượt phù hợp</div>
          <div class="empty-state-desc">
            ${data.error_code === 'E01'
              ? 'Hoàn thành thêm các môn tiên quyết để mở khóa lộ trình học vượt.'
              : 'Chưa có môn nào từ kỳ ' + (data.current_semester + 1) + ' trở đi trong chương trình đào tạo.'}
          </div>
        </div>
      </div>`;
  }

  _cannotTakeTable() {
    const { cannotTake } = this;
    return `
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">Môn chưa đủ điều kiện</h3>
          <span class="badge badge-warning">${cannotTake.length} môn</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Mã môn</th><th>Tên môn</th><th>TC</th><th>Kỳ</th><th>Còn thiếu tiên quyết</th></tr></thead>
            <tbody>
              ${cannotTake.map(s => `
                <tr>
                  <td><code>${Formatter.escapeHtml(s.subject_code)}</code></td>
                  <td>${Formatter.escapeHtml(s.subject_name)}</td>
                  <td>${s.credits}</td>
                  <td>Kỳ ${s.semester_default || '?'}</td>
                  <td>${(s.missing_prerequisites || []).map(p => `<span class="badge badge-danger" style="margin-right:4px">${Formatter.escapeHtml(p)}</span>`).join('')}</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  _savedPlanTable() {
    const { savedPlan } = this;
    return `
      <div class="card mt-4">
        <div class="card-header">
          <h3 class="card-title">Lộ trình đã lưu</h3>
          <span class="badge badge-success">${savedPlan.length} môn</span>
        </div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Mã môn</th><th>Tên môn</th><th>TC</th><th>Kỳ dự kiến</th></tr></thead>
            <tbody>
              ${savedPlan.map(s => `
                <tr>
                  <td><code>${Formatter.escapeHtml(s.subject_code)}</code></td>
                  <td>${Formatter.escapeHtml(s.subject_name)}</td>
                  <td>${s.credits}</td>
                  <td>Kỳ ${s.semester_target || '?'}</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  _bindEvents() {
    this.$all(".subj-chk").forEach(chk => {
      chk.addEventListener("change", () => {
        if (chk.checked) this.selected.add(chk.dataset.code);
        else this.selected.delete(chk.dataset.code);
        this._updateCreditSummary();
        this._updateSelectAllState();
      });
    });

    const chkAll = this.$("#chkAll");
    if (chkAll) {
      chkAll.checked = this.canTake.length > 0 && this.selected.size === this.canTake.length;
      chkAll.addEventListener("change", () => {
        if (chkAll.checked) this.canTake.forEach(s => this.selected.add(s.subject_code));
        else this.selected.clear();
        this._renderPage();
      });
    }

    this.$("#btnSelectAll")?.addEventListener("click", () => {
      this.canTake.forEach(s => this.selected.add(s.subject_code));
      this._renderPage();
    });
    this.$("#btnClearSel")?.addEventListener("click", () => {
      this.selected.clear();
      this._renderPage();
    });
    this.$("#btnRefresh")?.addEventListener("click", () => navigateTo("curriculum"));
    this.$("#btnSavePlan")?.addEventListener("click", () => this._savePlan());
  }

  _updateCreditSummary() {
    const el = this.$("#creditSummary");
    const countEl = this.$("#selectedCount");
    if (!el) return;
    const selCredits = this.canTake
      .filter(s => this.selected.has(s.subject_code))
      .reduce((sum, s) => sum + s.credits, 0);
    const over = selCredits > this.data.max_credits_per_semester;
    el.className = `alert ${over ? 'alert-danger' : selCredits > 0 ? 'alert-info' : 'alert-warning'} mb-0`;
    el.style.margin = "0";
    if (selCredits === 0) {
      el.textContent = "Chưa chọn môn nào. Tick vào các môn bạn muốn đăng ký học vượt rồi nhấn Lưu lộ trình.";
    } else if (over) {
      el.innerHTML = `Đã chọn <b>${this.selected.size} môn</b> = <b>${selCredits} TC</b>. Vượt giới hạn ${this.data.max_credits_per_semester} TC/kỳ! Hãy bỏ bớt môn.`;
    } else {
      el.innerHTML = `Đã chọn <b>${this.selected.size} môn</b> = <b>${selCredits} TC</b> / ${this.data.max_credits_per_semester} TC tối đa.`;
    }
    if (countEl) countEl.textContent = `Đã chọn ${this.selected.size} môn`;
  }

  _updateSelectAllState() {
    const chkAll = this.$("#chkAll");
    if (chkAll) chkAll.checked = this.canTake.length > 0 && this.selected.size === this.canTake.length;
  }

  async _savePlan() {
    if (this.selected.size === 0) {
      Toast.warning("Vui lòng chọn ít nhất 1 môn để lưu lộ trình");
      return;
    }
    const selCredits = this.canTake
      .filter(s => this.selected.has(s.subject_code))
      .reduce((sum, s) => sum + s.credits, 0);
    if (selCredits > this.data.max_credits_per_semester) {
      Toast.error(`Tổng tín chỉ (${selCredits} TC) vượt quá giới hạn ${this.data.max_credits_per_semester} TC/kỳ. Hãy bỏ bớt môn.`);
      return;
    }
    try {
      const result = await API.saveStudyPlan([...this.selected]);
      Toast.success(result.message || "Đã lưu lộ trình học vượt");
      this.savedPlan = await API.getStudyPlan().catch(() => []);
      this._renderPage();
    } catch (err) {
      Toast.error(err.message || "Lưu lộ trình thất bại");
    }
  }
}

BaseView.register("curriculum", CurriculumView);
