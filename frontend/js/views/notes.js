/**
 * Notes View - Quản lý ghi chú (Use Case 3.7-3.9)
 * Đã cập nhật: combobox tag, nút 3 chấm context menu
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.notes = async function(container) {
  let notes = await API.getNotes();
  let tags = await API.getNoteTags().catch(() => []);
  let searchText = "";
  let activeTag = "";

  render();

  function render() {
    container.innerHTML = `
      <div class="page-header">
        <div>
          <h1>Ghi chú</h1>
          <p>Lưu trữ ý tưởng, bài tập, ghi chú quan trọng theo môn học</p>
        </div>
        <div class="page-actions">
          <button class="btn btn-primary" id="btnAddNote">+ Tạo ghi chú</button>
        </div>
      </div>

      <!-- Filters -->
      <div class="card mb-4">
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          <input type="text" id="noteSearch" placeholder="🔍 Tìm theo tiêu đề hoặc nội dung..."
            class="form-control" style="flex:1;min-width:240px" value="${escapeHtml(searchText)}">
          <select id="tagSelect" class="form-control" style="width:200px">
            <option value="">📂 Tất cả nhãn</option>
            ${(tags||[]).map(t => `<option value="${escapeHtml(t)}" ${activeTag===t?"selected":""}>${escapeHtml(t)}</option>`).join("")}
          </select>
        </div>
      </div>

      <div id="notesGrid"></div>
    `;

    renderNotesGrid();
    document.getElementById("noteSearch").oninput = (e) => { searchText = e.target.value; renderNotesGrid(); };
    document.getElementById("tagSelect").onchange = (e) => { activeTag = e.target.value; renderNotesGrid(); };
    document.getElementById("btnAddNote").onclick = () => openNoteModal();
  }

  function renderNotesGrid() {
    const gridEl = document.getElementById("notesGrid");
    const filtered = notes.filter(n => {
      const matchSearch = !searchText ||
        n.title.toLowerCase().includes(searchText.toLowerCase()) ||
        n.content.toLowerCase().includes(searchText.toLowerCase());
      const matchTag = !activeTag || n.tag === activeTag;
      return matchSearch && matchTag;
    });
    filtered.sort((a, b) => (b.is_pinned - a.is_pinned) || (new Date(b.updated_at) - new Date(a.updated_at)));

    if (filtered.length === 0) {
      gridEl.innerHTML = `<div class="empty-state">
        <div class="empty-state-icon"></div>
        <div class="empty-state-title">Chưa có ghi chú</div>
        <div class="empty-state-desc">${searchText || activeTag ? "Không tìm thấy ghi chú phù hợp" : "Nhấn '+ Tạo ghi chú' để bắt đầu"}</div>
      </div>`;
      return;
    }

    gridEl.innerHTML = `<div class="notes-grid">${filtered.map(n => `
      <div class="note-card ${n.is_pinned?'pinned':''}" style="background:${n.color}" data-id="${n.id}">
        <div class="note-title">${escapeHtml(n.title)}</div>
        <div class="note-content">${escapeHtml(n.content)}</div>
        <div class="note-meta">
          ${n.tag?`<span class="note-tag">${escapeHtml(n.tag)}</span>`:'<span></span>'}
          <span>${timeAgo(n.updated_at)}</span>
        </div>
        <!-- Nút 3 chấm -->
        <button class="note-menu-btn" data-id="${n.id}"
          style="position:absolute;top:8px;right:${n.is_pinned?'30px':'8px'};background:rgba(0,0,0,0.08);border:none;border-radius:50%;width:28px;height:28px;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity 0.15s"
          title="Tùy chọn">⋮</button>
      </div>
    `).join("")}</div>`;

    // Hover để hiện nút 3 chấm
    gridEl.querySelectorAll(".note-card").forEach(el => {
      el.style.position = "relative";
      const btn = el.querySelector(".note-menu-btn");
      el.addEventListener("mouseenter", () => { if(btn) btn.style.opacity = "1"; });
      el.addEventListener("mouseleave", () => { if(btn) btn.style.opacity = "0"; });
      // Click body card -> mở edit
      el.addEventListener("click", (e) => {
        if (!e.target.classList.contains("note-menu-btn")) {
          editNote(parseInt(el.dataset.id));
        }
      });
    });

    // Nút 3 chấm -> context menu
    gridEl.querySelectorAll(".note-menu-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        openContextMenu(e, parseInt(btn.dataset.id));
      });
    });
  }

  // Context menu nổi (popup nhỏ)
  function openContextMenu(event, noteId) {
    // Xóa menu cũ nếu có
    document.querySelectorAll(".note-context-menu").forEach(m => m.remove());
    const note = notes.find(n => n.id === noteId);
    if (!note) return;

    const menu = document.createElement("div");
    menu.className = "note-context-menu";
    menu.style.cssText = `
      position:fixed;
      background:white;
      border:1px solid var(--border);
      border-radius:var(--radius);
      box-shadow:var(--shadow-lg);
      z-index:9000;
      min-width:160px;
      padding:4px 0;
      font-size:13px;
      animation:fadeIn 0.12s ease;
    `;

    const actions = [
      { icon: "✏", label: "Chỉnh sửa", fn: () => editNote(noteId) },
      { icon: note.is_pinned ? "📌" : "📍", label: note.is_pinned ? "Bỏ ghim" : "Ghim lên đầu", fn: () => togglePin(note) },
      { icon: "🗑", label: "Xóa ghi chú", fn: () => deleteNoteById(noteId), danger: true },
    ];

    menu.innerHTML = actions.map(a => `
      <div class="ctx-item" style="padding:8px 16px;cursor:pointer;display:flex;align-items:center;gap:8px;${a.danger?'color:var(--danger)':'color:var(--text-primary)'}">
        <span>${a.icon}</span><span>${a.label}</span>
      </div>
    `).join("");

    // Vị trí menu cạnh nút bấm
    document.body.appendChild(menu);
    const rect = event.target.getBoundingClientRect();
    const menuH = 120;
    const top = rect.bottom + 4 + menuH > window.innerHeight
      ? rect.top - menuH - 4 : rect.bottom + 4;
    menu.style.top = top + "px";
    menu.style.left = Math.min(rect.left, window.innerWidth - 170) + "px";

    menu.querySelectorAll(".ctx-item").forEach((el, i) => {
      el.onmouseenter = () => el.style.background = "var(--bg-hover)";
      el.onmouseleave = () => el.style.background = "";
      el.onclick = () => { menu.remove(); actions[i].fn(); };
    });

    // Đóng khi click ngoài
    setTimeout(() => {
      document.addEventListener("click", () => menu.remove(), { once: true });
    }, 0);
  }

  async function togglePin(note) {
    try {
      await API.updateNote(note.id, { is_pinned: !note.is_pinned });
      Toast.success(note.is_pinned ? "Đã bỏ ghim" : "Đã ghim ghi chú");
      notes = await API.getNotes();
      renderNotesGrid();
    } catch(err) { Toast.error(err.message); }
  }

  async function deleteNoteById(id) {
    const note = notes.find(n => n.id === id);
    if (!note) return;
    const ok = await Modal.confirm(`Xóa ghi chú "${note.title}"? Hành động này không thể hoàn tác.`);
    if (!ok) return;
    try {
      await API.deleteNote(id);
      Toast.success("Đã xóa ghi chú");
      notes = await API.getNotes();
      tags = await API.getNoteTags();
      render();
    } catch(err) { Toast.error(err.message); }
  }

  function editNote(id) {
    openNoteModal(notes.find(n => n.id === id));
  }

  function openNoteModal(item = null) {
    const isEdit = !!item;
    const data = item || { title:"", content:"", tag:"", color:"#FFF9C4", is_pinned:false, related_subject:"" };
    const COLORS = ["#FFF9C4","#FFCCBC","#C8E6C9","#B3E5FC","#E1BEE7","#FFCDD2","#F0F4C3","#DCEDC8"];

    const formEl = document.createElement("form");
    formEl.innerHTML = `
      <div class="form-group">
        <label class="form-label">Tiêu đề <span class="required">*</span></label>
        <input name="title" class="form-control" value="${escapeHtml(data.title)}" required placeholder="Tiêu đề ghi chú">
      </div>
      <div class="form-group">
        <label class="form-label">Nội dung <span class="required">*</span></label>
        <textarea name="content" class="form-control" rows="6" required placeholder="Nội dung ghi chú...">${escapeHtml(data.content)}</textarea>
      </div>
      <div class="auth-form-row">
        <div class="form-group">
          <label class="form-label">Nhãn / Phân loại</label>
          <input name="tag" class="form-control" value="${escapeHtml(data.tag||"")}" placeholder="Bài tập, Lý thuyết..."
            list="tag_suggestions">
          <datalist id="tag_suggestions">
            ${(tags||[]).map(t => `<option value="${escapeHtml(t)}">`).join("")}
          </datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Môn liên quan</label>
          <input name="related_subject" class="form-control" value="${escapeHtml(data.related_subject||"")}" placeholder="CSE221">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Màu nền</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${COLORS.map(c => `
            <label style="cursor:pointer">
              <input type="radio" name="color" value="${c}" ${data.color===c?"checked":""} style="display:none">
              <div style="width:36px;height:36px;border-radius:50%;background:${c};border:3px solid ${data.color===c?'var(--tlu-primary)':'transparent'};box-shadow:0 1px 3px rgba(0,0,0,0.15)" data-color="${c}"></div>
            </label>`).join("")}
        </div>
      </div>
      <label class="checkbox">
        <input type="checkbox" name="is_pinned" ${data.is_pinned?"checked":""}>
        <span>📌 Ghim ghi chú này lên đầu</span>
      </label>
    `;

    formEl.querySelectorAll("[data-color]").forEach(el => {
      el.onclick = () => {
        formEl.querySelectorAll("[data-color]").forEach(e => e.style.borderColor = "transparent");
        el.style.borderColor = "var(--tlu-primary)";
        formEl.querySelector(`input[name="color"][value="${el.dataset.color}"]`).checked = true;
      };
    });

    const footer = document.createElement("div");
    footer.innerHTML = `
      ${isEdit?'<button type="button" class="btn btn-danger" data-action="delete" style="margin-right:auto">Xóa</button>':""}
      <button type="button" class="btn btn-secondary" data-action="cancel">Hủy</button>
      <button type="button" class="btn btn-primary" data-action="save">💾 ${isEdit?"Cập nhật":"Lưu"}</button>
    `;
    const modal = Modal.show({ title: isEdit?"Chỉnh sửa ghi chú":"+ Tạo ghi chú mới", body:formEl, footer });

    footer.querySelector('[data-action="cancel"]').onclick = () => modal.close();
    footer.querySelector('[data-action="save"]').onclick = async () => {
      const fd = new FormData(formEl);
      const payload = {
        title: fd.get("title")?.trim(),
        content: fd.get("content")?.trim(),
        tag: fd.get("tag")?.trim()||null,
        related_subject: fd.get("related_subject")?.trim()||null,
        color: fd.get("color")||"#FFF9C4",
        is_pinned: fd.get("is_pinned")==="on",
      };
      if (!payload.title || !payload.content) { Toast.error("Vui lòng nhập đủ tiêu đề và nội dung"); return; }
      try {
        if (isEdit) { await API.updateNote(item.id, payload); Toast.success("Đã cập nhật"); }
        else { await API.createNote(payload); Toast.success("Đã tạo ghi chú"); }
        modal.close();
        notes = await API.getNotes();
        tags = await API.getNoteTags();
        render();
      } catch(err) { Toast.error(err.message); }
    };

    if (isEdit) {
      footer.querySelector('[data-action="delete"]').onclick = async () => {
        const ok = await Modal.confirm(`Xóa ghi chú "${item.title}"?`);
        if (!ok) return;
        try {
          await API.deleteNote(item.id);
          Toast.success("Đã xóa ghi chú");
          modal.close();
          notes = await API.getNotes();
          tags = await API.getNoteTags();
          render();
        } catch(err) { Toast.error(err.message); }
      };
    }
  }
};
