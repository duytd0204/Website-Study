/**
 * GPAView - Quản lý điểm số & GPA.
 * 2 thành phần điểm (QT + Thi), hệ số tuỳ chỉnh, phân trang, accordion theo kỳ.
 * State trước đây là biến closure (subjects, gpa, currentPage, ...) giờ là
 * thuộc tính instance (this.subjects, this.gpa, this.currentPage, ...).
 */
class GPAView extends BaseView {
  static PAGE_SIZE = 10;

  constructor(container) {
    super(container);
    this.currentPage = 1;
    this.searchText = "";
    this.semFilter = "";
    this.expandedSems = new Set();
  }

  async render() {
    this.subjects = await API.getSubjects();
    this.gpa = await API.getGPA();
    this._sortSubjects();
    this._renderPage();
  }

  _sortSubjects() {
    this.subjects.sort((a, b) => (b.semester || "").localeCompare(a.semester || ""));
  }

  _renderPage() {
    const gpa4 = this.gpa.gpa_4 || 0;
    const gpa10 = this.gpa.gpa_10 || 0;
    const percent = Math.min(gpa4 / 4 * 360, 360);
    const semesters = [...new Set(this.subjects.map(s => s.semester).filter(Boolean))].sort().reverse();

    this.setHTML(`
      <div class="page-header">
        <div>
          <h1>Điểm số & GPA</h1>
          <p>Quản lý điểm · Tính GPA tự động · Dự đoán điểm tương lai</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-secondary" id="btnImportTranscript">Quét bảng điểm</button>
          <button class="btn btn-warning" id="btnPredict">Dự đoán GPA</button>
          <button class="btn btn-primary" id="btnAddSubject">+ Thêm môn học</button>
        </div>
      </div>

      <div class="stats-grid">
        <div class="card" style="display:flex;align-items:center;gap:20px;padding:24px">
          <div class="gpa-circle" style="--p:${percent}deg;width:120px;height:120px">
            <div class="gpa-circle-inner">
              <div class="gpa-circle-value" style="font-size:24px">${gpa4.toFixed(2)}</div>
              <div class="gpa-circle-label">hệ 4</div>
            </div>
          </div>
          <div>
            <div class="text-muted text-sm">Xếp loại</div>
            <h2 style="margin:4px 0;font-size:22px;color:var(--tlu-primary)">${this.gpa.classification || "—"}</h2>
            <div class="text-sm" style="margin-top:4px">GPA hệ 10: <b>${gpa10.toFixed(2)}</b></div>
          </div>
        </div>
        <div class="stat-card success">
          <div class="stat-label">Môn đã đạt</div>
          <div class="stat-value">${this.gpa.completed_subjects || 0}</div>
          <div class="stat-change">${this.gpa.earned_credits || 0} tín chỉ</div>
        </div>
        <div class="stat-card ${(this.gpa.failed_subjects||0)>0?'danger':'success'}">
          <div class="stat-label">Chưa đạt</div>
          <div class="stat-value">${this.gpa.failed_subjects || 0}</div>
          <div class="stat-change">${(this.gpa.failed_subjects||0)>0?"Cần học lại":"Tốt!"}</div>
        </div>
        <div class="stat-card accent">
          <div class="stat-label">Tổng tín chỉ</div>
          <div class="stat-value">${this.gpa.total_credits || 0}</div>
          <div class="stat-change">Đã đăng ký</div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3 class="card-title">Bảng điểm tổng</h3>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" placeholder="Tìm môn..." id="searchSubject" class="form-control"
              style="width:200px;padding:6px 10px;font-size:13px" value="${Formatter.escapeHtml(this.searchText)}">
            <select id="filterSemester" class="form-control" style="width:140px;padding:6px 10px;font-size:13px">
              <option value="">Tất cả kỳ</option>
              ${semesters.map(s => `<option value="${s}" ${this.semFilter===s?"selected":""}>${s}</option>`).join("")}
            </select>
          </div>
        </div>
        <div id="subjectsList"></div>
        <div id="subjectsPagination" style="display:flex;align-items:center;justify-content:flex-end;gap:8px;padding:12px 0 0;border-top:1px solid var(--border-light)"></div>
      </div>

      ${(this.gpa.by_semester||[]).length > 0 ? `
        <div class="card mt-4">
          <div class="card-header"><h3 class="card-title">GPA theo học kỳ</h3></div>
          <div id="semAccordion"></div>
        </div>
      ` : ''}
    `);

    this._renderSubjectsList();
    this._renderAccordion();

    this.$("#searchSubject").oninput = (e) => { this.searchText = e.target.value; this.currentPage = 1; this._renderSubjectsList(); };
    this.$("#filterSemester").onchange = (e) => { this.semFilter = e.target.value; this.currentPage = 1; this._renderSubjectsList(); };
    this.$("#btnAddSubject").onclick = () => this._openSubjectModal();
    this.$("#btnImportTranscript").onclick = () => navigateTo("ocr");
    this.$("#btnPredict").onclick = () => this._openPredictModal();
  }

  _renderSubjectsList() {
    const filtered = this.subjects.filter(s => {
      const matchText = !this.searchText ||
        s.subject_name.toLowerCase().includes(this.searchText.toLowerCase()) ||
        (s.subject_code||"").toLowerCase().includes(this.searchText.toLowerCase());
      return matchText && (!this.semFilter || s.semester === this.semFilter);
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / GPAView.PAGE_SIZE));
    if (this.currentPage > totalPages) this.currentPage = totalPages;
    const paged = filtered.slice((this.currentPage-1)*GPAView.PAGE_SIZE, this.currentPage*GPAView.PAGE_SIZE);

    const listEl = this.$("#subjectsList");
    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="empty-state">
        <div class="empty-state-title">Chưa có môn học</div>
        <div class="empty-state-desc">Nhấn "+ Thêm môn học" để bắt đầu</div></div>`;
    } else {
      listEl.innerHTML = `
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Mã</th><th>Tên môn</th><th>HK</th><th>TC</th>
                <th>Điểm QT</th><th>Hệ số</th><th>Điểm thi</th>
                <th>Tổng /10</th><th>/4</th><th>Loại</th><th>TT</th><th></th></tr>
            </thead>
            <tbody>${paged.map(s => this._subjectRow(s)).join("")}</tbody>
          </table>
        </div>`;
      listEl.querySelectorAll("[data-edit]").forEach(b =>
        b.addEventListener("click", () => this._editSubject(parseInt(b.dataset.edit))));
      listEl.querySelectorAll("[data-del]").forEach(b =>
        b.addEventListener("click", () => this._deleteSubject(parseInt(b.dataset.del))));
    }

    this._renderPagination(filtered.length, totalPages);
  }

  _subjectRow(s) {
    return `
      <tr ${s.is_predicted?'style="background:var(--warning-bg)"':''}>
        <td><code style="font-size:11px">${Formatter.escapeHtml(s.subject_code||"-")}</code></td>
        <td>${Formatter.escapeHtml(s.subject_name)}
          ${s.is_predicted?'<span class="badge badge-warning" style="font-size:9px;margin-left:4px">DỰ ĐOÁN</span>':''}
        </td>
        <td>${Formatter.escapeHtml(s.semester||"-")}</td>
        <td>${s.credits}</td>
        <td>${s.process_score!=null?s.process_score.toFixed(1):"-"}</td>
        <td>${s.process_weight!=null?(s.process_weight*100).toFixed(0)+"%":"-"}</td>
        <td>${s.final_score!=null?s.final_score.toFixed(1):"-"}</td>
        <td><b>${s.total_score_10!=null?s.total_score_10.toFixed(2):"-"}</b></td>
        <td><b style="color:var(--tlu-primary)">${s.total_score_4!=null?s.total_score_4.toFixed(1):"-"}</b></td>
        <td>${s.letter_grade?`<span class="badge badge-${Formatter.gradeColor(s.letter_grade)}">${s.letter_grade}</span>`:"-"}</td>
        <td>${s.is_passed?'<span class="badge badge-success">Đạt</span>':s.total_score_10!=null?'<span class="badge badge-danger">Trượt</span>':'<span class="badge badge-secondary">Chưa</span>'}</td>
        <td>
          <div style="display:flex;gap:4px">
            <button class="btn btn-secondary btn-sm" style="min-width:54px" data-edit="${s.id}">Sửa</button>
            <button class="btn btn-danger btn-sm" style="min-width:50px;opacity:0.85" data-del="${s.id}">Xóa</button>
          </div>
        </td>
      </tr>`;
  }

  _renderPagination(totalItems, totalPages) {
    const pgEl = this.$("#subjectsPagination");
    if (totalPages <= 1) { pgEl.innerHTML = ""; return; }
    pgEl.innerHTML = `
      <span class="text-sm text-muted">${totalItems} môn học · Trang ${this.currentPage}/${totalPages}</span>
      <button class="btn btn-secondary btn-sm" id="pgPrev" ${this.currentPage<=1?"disabled":""}>‹ Trước</button>
      ${Array.from({length:totalPages},(_,i)=>i+1).map(p =>
        `<button class="btn ${p===this.currentPage?'btn-primary':'btn-secondary'} btn-sm pg-num" data-page="${p}">${p}</button>`
      ).join("")}
      <button class="btn btn-secondary btn-sm" id="pgNext" ${this.currentPage>=totalPages?"disabled":""}>Sau ›</button>
    `;
    pgEl.querySelector("#pgPrev")?.addEventListener("click", () => { this.currentPage--; this._renderSubjectsList(); });
    pgEl.querySelector("#pgNext")?.addEventListener("click", () => { this.currentPage++; this._renderSubjectsList(); });
    pgEl.querySelectorAll(".pg-num").forEach(b =>
      b.addEventListener("click", () => { this.currentPage = parseInt(b.dataset.page); this._renderSubjectsList(); }));
  }

  _renderAccordion() {
    const el = this.$("#semAccordion");
    if (!el) return;
    const bySem = this.gpa.by_semester || [];
    el.innerHTML = bySem.map(s => this._accordionItem(s)).join("");
    el.querySelectorAll("[data-sem]").forEach(btn => {
      btn.addEventListener("click", () => {
        const sem = btn.dataset.sem;
        if (this.expandedSems.has(sem)) this.expandedSems.delete(sem);
        else this.expandedSems.add(sem);
        this._renderAccordion();
      });
    });
  }

  _accordionItem(s) {
    const isOpen = this.expandedSems.has(s.semester);
    const semSubjects = this.subjects.filter(sub => sub.semester === s.semester && sub.total_score_10 != null && !sub.is_predicted);
    return `
      <div style="border-bottom:1px solid var(--border-light)">
        <button class="btn btn-ghost w-full" style="justify-content:space-between;padding:14px 16px;border-radius:0;font-size:14px"
          data-sem="${Formatter.escapeHtml(s.semester)}">
          <span>
            <b>Học kỳ ${Formatter.escapeHtml(s.semester)}</b>
            <span class="text-muted" style="margin-left:12px;font-weight:400">${s.subjects_count} môn · ${s.credits} TC · GPA: <b style="color:var(--tlu-primary)">${s.gpa_4.toFixed(2)}</b>/4 (${s.gpa_10.toFixed(2)}/10)</span>
          </span>
          <span>${isOpen?"▲":"▼"}</span>
        </button>
        ${isOpen ? `
          <div style="padding:0 8px 12px;background:var(--bg-hover)">
            <table class="table" style="font-size:12px">
              <thead><tr><th>Mã</th><th>Tên môn</th><th>TC</th><th>QT</th><th>Thi</th><th>Tổng</th><th>/4</th><th>Loại</th></tr></thead>
              <tbody>
                ${semSubjects.length > 0 ? semSubjects.map(sub => `
                  <tr>
                    <td><code>${Formatter.escapeHtml(sub.subject_code||"-")}</code></td>
                    <td>${Formatter.escapeHtml(sub.subject_name)}</td>
                    <td>${sub.credits}</td>
                    <td>${sub.process_score!=null?sub.process_score.toFixed(1):"-"}</td>
                    <td>${sub.final_score!=null?sub.final_score.toFixed(1):"-"}</td>
                    <td><b>${sub.total_score_10!=null?sub.total_score_10.toFixed(2):"-"}</b></td>
                    <td><b style="color:var(--tlu-primary)">${sub.total_score_4!=null?sub.total_score_4.toFixed(1):"-"}</b></td>
                    <td>${sub.letter_grade?`<span class="badge badge-${Formatter.gradeColor(sub.letter_grade)}">${sub.letter_grade}</span>`:"-"}</td>
                  </tr>`).join("") :
                  `<tr><td colspan="8" class="text-muted text-center" style="padding:12px">Không có dữ liệu chi tiết</td></tr>`
                }
              </tbody>
            </table>
          </div>
        ` : ""}
      </div>
    `;
  }

  _openSubjectModal(item = null) {
    const isEdit = !!item;
    const data = item || { subject_code:"", subject_name:"", credits:3, semester:"", school_year:"", process_score:null, final_score:null, process_weight:0.4, total_score_10:null, is_predicted:false };
    const pw = (data.process_weight || 0.4) * 100;

    const formEl = document.createElement("form");
    formEl.innerHTML = `
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Mã môn <span class="required">*</span></label>
          <input name="subject_code" class="form-control" value="${Formatter.escapeHtml(data.subject_code||"")}" required placeholder="VD: CSE221">
        </div>
        <div class="form-group">
          <label class="form-label">Tín chỉ <span class="required">*</span></label>
          <input type="number" name="credits" class="form-control" min="1" max="20" value="${data.credits||3}" required>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Tên môn <span class="required">*</span></label>
        <input name="subject_name" class="form-control" value="${Formatter.escapeHtml(data.subject_name||"")}" required placeholder="Cấu trúc dữ liệu và Giải thuật">
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Học kỳ</label>
          <input name="semester" class="form-control" value="${Formatter.escapeHtml(data.semester||"")}" placeholder="VD: 20241">
        </div>
        <div class="form-group">
          <label class="form-label">Năm học</label>
          <input name="school_year" class="form-control" value="${Formatter.escapeHtml(data.school_year||"")}" placeholder="2024-2025">
        </div>
      </div>

      <hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0">
      <p style="margin:0 0 12px;font-weight:600;font-size:13px;color:var(--text-secondary)">Nhập điểm thành phần:</p>

      <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end">
        <div class="form-group" style="margin:0">
          <label class="form-label">Điểm quá trình /10</label>
          <input type="number" name="process_score" class="form-control"
            min="0" max="10" step="0.1" value="${data.process_score??""}" placeholder="VD: 8.0">
        </div>
        <div style="text-align:center;padding-bottom:6px">
          <div class="text-muted text-sm">Hệ số</div>
          <div id="pw_display" style="font-weight:700;font-size:16px;color:var(--tlu-primary)">${pw.toFixed(0)}% / ${(100-pw).toFixed(0)}%</div>
        </div>
        <div class="form-group" style="margin:0">
          <label class="form-label">Điểm thi /10</label>
          <input type="number" name="final_score" class="form-control"
            min="0" max="10" step="0.1" value="${data.final_score??""}" placeholder="VD: 7.5">
        </div>
      </div>

      <div class="form-group mt-3">
        <label class="form-label">Hệ số điểm quá trình: <b id="pw_label">${pw.toFixed(0)}%</b></label>
        <input type="range" name="process_weight_pct" id="pw_slider"
          min="10" max="70" step="5" value="${pw.toFixed(0)}" style="width:100%;accent-color:var(--tlu-primary)">
        <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--text-muted);margin-top:2px">
          <span>QT 10%</span><span>QT 40% (mặc định)</span><span>QT 70%</span>
        </div>
      </div>

      <div id="pw_preview" style="background:var(--info-bg);border-radius:var(--radius);padding:10px 14px;font-size:13px;margin-top:4px"></div>

      <hr style="border:none;border-top:1px solid var(--border-light);margin:16px 0">
      <div class="form-group">
        <label class="form-label">Hoặc nhập thẳng điểm tổng kết /10</label>
        <input type="number" name="total_score_10" class="form-control"
          min="0" max="10" step="0.01" value="${data.total_score_10??""}"
          placeholder="VD: 8.5 (nếu nhập thì bỏ qua các ô trên)">
        <p class="form-help">Điền ô này nếu bạn đã có điểm tổng kết chính thức — hệ thống sẽ không tính lại từ thành phần.</p>
      </div>
      <label class="checkbox">
        <input type="checkbox" name="is_predicted" ${data.is_predicted?"checked":""}>
        <span>Đây là điểm dự đoán (chưa chính thức)</span>
      </label>
    `;

    this._bindScorePreview(formEl);

    const footer = document.createElement("div");
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Hủy</button>
      <button type="button" class="btn btn-primary" data-action="save">${isEdit?"Cập nhật":"Thêm"}</button>
    `;
    const modal = Modal.show({ title: isEdit?"Sửa môn học":"+ Thêm môn học", body:formEl, footer });
    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = () => this._saveSubject(formEl, modal, item);
  }

  _bindScorePreview(formEl) {
    const updatePreview = () => {
      const qt = parseFloat(formEl.querySelector('[name="process_score"]').value);
      const thi = parseFloat(formEl.querySelector('[name="final_score"]').value);
      const hs = parseInt(formEl.querySelector('#pw_slider').value) / 100;
      formEl.querySelector('#pw_label').textContent = (hs*100).toFixed(0) + "%";
      formEl.querySelector('#pw_display').textContent = `${(hs*100).toFixed(0)}% / ${((1-hs)*100).toFixed(0)}%`;
      const preview = formEl.querySelector('#pw_preview');
      if (!isNaN(thi)) {
        const total = !isNaN(qt) ? (qt*hs + thi*(1-hs)) : thi;
        const { grade, color } = GPAView._scoreToGradeColor(total);
        preview.innerHTML = `Điểm tổng kết dự kiến: <b style="font-size:16px;color:${color}">${total.toFixed(2)}/10</b> = <b style="color:${color}">${grade}</b>`;
      } else {
        preview.innerHTML = '<span class="text-muted">Nhập điểm thi để xem trước tổng kết...</span>';
      }
    };
    formEl.querySelector('#pw_slider').addEventListener('input', updatePreview);
    formEl.querySelector('[name="process_score"]').addEventListener('input', updatePreview);
    formEl.querySelector('[name="final_score"]').addEventListener('input', updatePreview);
    setTimeout(updatePreview, 0);
  }

  static _scoreToGradeColor(total) {
    if (total >= 8.5) return { grade: "A",  color: "var(--success)" };
    if (total >= 8.0) return { grade: "B+", color: "var(--success)" };
    if (total >= 7.0) return { grade: "B",  color: "var(--info)" };
    if (total >= 6.5) return { grade: "C+", color: "var(--warning)" };
    if (total >= 5.5) return { grade: "C",  color: "var(--warning)" };
    if (total >= 5.0) return { grade: "D+", color: "var(--warning)" };
    if (total >= 4.0) return { grade: "D",  color: "var(--warning)" };
    return { grade: "F", color: "var(--danger)" };
  }

  async _saveSubject(formEl, modal, item) {
    const isEdit = !!item;
    const fd = new FormData(formEl);
    const payload = {
      subject_code: fd.get("subject_code")?.trim() || null,
      subject_name: fd.get("subject_name")?.trim(),
      credits: parseInt(fd.get("credits"))||3,
      semester: fd.get("semester")?.trim()||null,
      school_year: fd.get("school_year")?.trim()||null,
      process_score: fd.get("process_score")!==""?parseFloat(fd.get("process_score")):null,
      final_score: fd.get("final_score")!==""?parseFloat(fd.get("final_score")):null,
      process_weight: parseInt(fd.get("process_weight_pct"))/100,
      total_score_10: fd.get("total_score_10")!==""?parseFloat(fd.get("total_score_10")):null,
      is_predicted: fd.get("is_predicted")==="on",
      midterm_score: null,
    };
    if (!payload.subject_code) { Toast.error("Vui lòng nhập mã môn học"); return; }
    if (!payload.subject_name) { Toast.error("Vui lòng nhập tên môn học"); return; }
    try {
      if (isEdit) { await API.updateSubject(item.id, payload); Toast.success("Đã cập nhật"); }
      else { await API.createSubject(payload); Toast.success("Đã thêm môn học"); }
      modal.close();
      this.subjects = await API.getSubjects();
      this._sortSubjects();
      this.gpa = await API.getGPA();
      this._renderPage();
    } catch (err) { Toast.error(err.message); }
  }

  _editSubject(id) {
    this._openSubjectModal(this.subjects.find(s => s.id === id));
  }

  async _deleteSubject(id) {
    const item = this.subjects.find(s => s.id === id);
    if (!item) return;
    const ok = await Modal.confirm(`Xóa môn "${item.subject_name}"?`);
    if (!ok) return;
    try {
      await API.deleteSubject(id);
      Toast.success("Đã xóa");
      this.subjects = await API.getSubjects();
      this.gpa = await API.getGPA();
      this._renderPage();
    } catch (err) { Toast.error(err.message); }
  }

  _openPredictModal() {
    const formEl = document.createElement("div");
    formEl.innerHTML = `
      <div class="alert alert-info">Thêm các môn sắp học với điểm dự kiến để tính GPA tương lai.</div>
      <div id="predictRows"></div>
      <button type="button" class="btn btn-secondary btn-sm" id="btnAddRow">+ Thêm môn</button>
      <hr style="margin:16px 0">
      <div id="predictResult"></div>
    `;
    const footer = document.createElement("div");
    footer.innerHTML = `
      <button type="button" class="btn btn-secondary" data-action="cancel">Đóng</button>
      <button type="button" class="btn btn-primary" data-action="calc">Tính dự đoán</button>
    `;
    const modal = Modal.show({ title:"Dự đoán GPA", body:formEl, footer, size:"lg" });
    const rowsEl = formEl.querySelector("#predictRows");

    const addRow = () => {
      const row = document.createElement("div");
      row.className = "auth-form-row predict-row";
      row.style.cssText = "grid-template-columns:2fr 1fr 1fr auto;align-items:end";
      row.innerHTML = `
        <div class="form-group"><label class="form-label">Tên môn</label>
          <input class="form-control predict-name" placeholder="VD: Học máy"></div>
        <div class="form-group"><label class="form-label">Tín chỉ</label>
          <input type="number" class="form-control predict-credits" min="1" max="20" value="3"></div>
        <div class="form-group"><label class="form-label">Điểm dự kiến /10</label>
          <input type="number" class="form-control predict-score" min="0" max="10" step="0.1" value="8.0"></div>
        <div class="form-group"><button type="button" class="btn btn-ghost predict-remove">Xóa</button></div>`;
      row.querySelector(".predict-remove").onclick = () => row.remove();
      rowsEl.appendChild(row);
    };
    formEl.querySelector("#btnAddRow").onclick = addRow;
    addRow(); addRow();

    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="calc"]').onclick = () => this._calculatePrediction(rowsEl, formEl);
  }

  async _calculatePrediction(rowsEl, formEl) {
    const items = [];
    rowsEl.querySelectorAll(".predict-row").forEach(r => {
      const name = r.querySelector(".predict-name").value.trim();
      const credits = parseInt(r.querySelector(".predict-credits").value);
      const score = parseFloat(r.querySelector(".predict-score").value);
      if (name && credits > 0 && score >= 0) {
        items.push({ subject_name:name, credits, total_score_10:score, is_predicted:true, subject_code:"PRED", process_weight:0.4 });
      }
    });
    if (items.length === 0) { Toast.error("Vui lòng nhập ít nhất 1 môn"); return; }

    try {
      const result = await API.predictGPA(items);
      const diff = result.predicted_gpa_4 - result.current_gpa_4;
      formEl.querySelector("#predictResult").innerHTML = `
        <h4>Kết quả</h4>
        <div class="auth-form-row" style="grid-template-columns:1fr 1fr">
          <div class="card" style="background:var(--bg-hover)">
            <div class="text-sm text-muted">GPA hiện tại</div>
            <div style="font-size:24px;font-weight:800">${result.current_gpa_4.toFixed(2)}</div>
            <div class="text-sm">Hệ 10: ${result.current_gpa_10.toFixed(2)}</div>
          </div>
          <div class="card" style="background:var(--info-bg);border:1px solid var(--tlu-primary)">
            <div class="text-sm text-muted">GPA sau dự đoán</div>
            <div style="font-size:24px;font-weight:800;color:var(--tlu-primary)">${result.predicted_gpa_4.toFixed(2)}</div>
            <div class="text-sm">${result.predicted_classification} · ${result.total_credits_after} TC
              ${diff!==0?`<span class="badge ${diff>0?'badge-success':'badge-danger'}" style="margin-left:6px">${diff>0?'+':''}${diff.toFixed(2)}</span>`:''}
            </div>
          </div>
        </div>`;
    } catch (err) { Toast.error(err.message); }
  }
}

BaseView.register("gpa", GPAView);
