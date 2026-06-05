/**
 * OCR View - Trích xuất dữ liệu từ ảnh (Use Case 3.12)
 */
window.VIEWS = window.VIEWS || {};
window.VIEWS.ocr = async function(container) {
  let currentType = "schedule";
  let extractedItems = [];
  let imageFile = null;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1>📸 Quét ảnh với AI OCR</h1>
        <p>Tự động trích xuất thời khóa biểu hoặc bảng điểm từ ảnh chụp</p>
      </div>
    </div>

    <div class="alert alert-info">
      💡 <b>Hướng dẫn:</b> Chụp ảnh rõ nét bảng điểm hoặc thời khóa biểu, hệ thống sẽ dùng AI để đọc và trích xuất dữ liệu. Bạn có thể chỉnh sửa trước khi lưu vào hệ thống.
    </div>

    <div class="card">
      <div class="card-header">
        <h3 class="card-title">1. Chọn loại ảnh</h3>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:20px">
        <button class="btn btn-primary type-btn" data-type="schedule">📅 Thời khóa biểu</button>
        <button class="btn btn-secondary type-btn" data-type="transcript">📊 Bảng điểm</button>
      </div>

      <h3 class="card-title">2. Tải lên ảnh</h3>
      <div class="upload-zone" id="uploadZone">
        <div class="upload-zone-icon">📤</div>
        <h3 style="margin:0 0 8px">Kéo thả ảnh vào đây</h3>
        <p class="text-muted">hoặc <a href="#" id="browseFile" style="color:var(--tlu-primary);font-weight:600">chọn file từ máy</a></p>
        <p class="text-sm text-muted mt-2">Định dạng JPG, PNG, WebP · Tối đa 10MB</p>
        <input type="file" id="fileInput" accept="image/jpeg,image/png,image/webp" style="display:none">
      </div>

      <div id="previewArea" class="hidden mt-4">
        <img id="previewImg" class="upload-preview" alt="Preview">
        <div class="flex justify-center gap-2 mt-3">
          <button class="btn btn-secondary" id="btnReset">🔄 Chọn ảnh khác</button>
          <button class="btn btn-primary" id="btnExtract">🤖 Trích xuất bằng AI</button>
        </div>
      </div>
    </div>

    <div id="resultArea" class="hidden mt-4"></div>
  `;

  // Tabs
  document.querySelectorAll(".type-btn").forEach(b => {
    b.onclick = () => {
      currentType = b.dataset.type;
      document.querySelectorAll(".type-btn").forEach(b2 => {
        b2.className = b2.dataset.type === currentType ? "btn btn-primary type-btn" : "btn btn-secondary type-btn";
      });
    };
  });

  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");
  document.getElementById("browseFile").onclick = (e) => { e.preventDefault(); fileInput.click(); };
  uploadZone.onclick = () => fileInput.click();
  fileInput.onchange = (e) => handleFile(e.target.files[0]);

  // Drag-drop
  ["dragenter", "dragover"].forEach(ev => uploadZone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); uploadZone.classList.add("dragover");
  }));
  ["dragleave", "drop"].forEach(ev => uploadZone.addEventListener(ev, e => {
    e.preventDefault(); e.stopPropagation(); uploadZone.classList.remove("dragover");
  }));
  uploadZone.addEventListener("drop", e => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  function handleFile(file) {
    if (!file) return;
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      Toast.error("Chỉ chấp nhận JPG, PNG, WebP");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      Toast.error("Ảnh không được lớn hơn 10MB");
      return;
    }
    imageFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById("previewImg").src = e.target.result;
      document.getElementById("previewArea").classList.remove("hidden");
      uploadZone.classList.add("hidden");
    };
    reader.readAsDataURL(file);
  }

  document.getElementById("btnReset").onclick = () => {
    imageFile = null;
    extractedItems = [];
    fileInput.value = "";
    document.getElementById("previewArea").classList.add("hidden");
    uploadZone.classList.remove("hidden");
    document.getElementById("resultArea").classList.add("hidden");
  };

  document.getElementById("btnExtract").onclick = async () => {
    if (!imageFile) return;
    const btn = document.getElementById("btnExtract");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-top-color:white"></span> Đang phân tích...';

    try {
      const result = await API.ocrExtract(imageFile, currentType);
      extractedItems = result.items || [];
      if (extractedItems.length === 0) {
        Toast.warning(result.message || "Không trích xuất được dữ liệu. Hãy thử ảnh rõ hơn.");
        return;
      }
      Toast.success(`Trích xuất thành công ${extractedItems.length} mục`);
      renderResults();
    } catch (err) {
      Toast.error(err.message);
    } finally {
      btn.disabled = false;
      btn.innerHTML = '🤖 Trích xuất bằng AI';
    }
  };

  function renderResults() {
    const area = document.getElementById("resultArea");
    area.classList.remove("hidden");
    if (currentType === "schedule") {
      renderScheduleResults(area);
    } else {
      renderTranscriptResults(area);
    }
  }

  function renderScheduleResults(area) {
    area.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">3. Xác nhận và chỉnh sửa lịch học</h3>
          <span class="badge badge-success">${extractedItems.length} buổi</span>
        </div>
        <div class="alert alert-warning">
          ⚠ Hãy kiểm tra dữ liệu trích xuất bên dưới. Bạn có thể chỉnh sửa, xóa hoặc thêm trước khi lưu.
        </div>
        <div class="table-wrap">
          <table class="table" id="ocrTable">
            <thead>
              <tr>
                <th>Thứ</th><th>Giờ BĐ</th><th>Giờ KT</th>
                <th>Tên môn</th><th>Mã môn</th><th>Phòng</th><th>GV</th><th>Tuần</th><th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn btn-secondary" id="btnCancelSave">Hủy</button>
          <button class="btn btn-primary" id="btnSaveAll">💾 Lưu toàn bộ vào hệ thống</button>
        </div>
      </div>
    `;

    const tbody = area.querySelector("tbody");
    function renderRows() {
      tbody.innerHTML = "";
      extractedItems.forEach((item, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>
            <select class="form-control" style="padding:4px;font-size:12px" data-field="day_of_week" data-idx="${idx}">
              ${[2,3,4,5,6,7,8].map(d => `<option value="${d}" ${item.day_of_week==d?"selected":""}>${dayName(d)}</option>`).join("")}
            </select>
          </td>
          <td><input type="time" class="form-control" style="padding:4px;font-size:12px" data-field="start_time" data-idx="${idx}" value="${(item.start_time||"07:00").slice(0,5)}"></td>
          <td><input type="time" class="form-control" style="padding:4px;font-size:12px" data-field="end_time" data-idx="${idx}" value="${(item.end_time||"09:25").slice(0,5)}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;min-width:160px" data-field="subject_name" data-idx="${idx}" value="${escapeHtml(item.subject_name||"")}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;width:80px" data-field="subject_code" data-idx="${idx}" value="${escapeHtml(item.subject_code||"")}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;width:90px" data-field="room" data-idx="${idx}" value="${escapeHtml(item.room||"")}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;width:120px" data-field="teacher" data-idx="${idx}" value="${escapeHtml(item.teacher||"")}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;width:80px" data-field="weeks" data-idx="${idx}" value="${escapeHtml(item.weeks||"")}"></td>
          <td><button class="btn btn-ghost btn-sm" data-remove="${idx}">🗑</button></td>
        `;
        tbody.appendChild(row);
      });
      tbody.querySelectorAll("[data-field]").forEach(el => {
        el.onchange = () => {
          const idx = parseInt(el.dataset.idx);
          extractedItems[idx][el.dataset.field] = el.value;
        };
      });
      tbody.querySelectorAll("[data-remove]").forEach(b => {
        b.onclick = () => {
          extractedItems.splice(parseInt(b.dataset.remove), 1);
          renderRows();
        };
      });
    }
    renderRows();

    area.querySelector("#btnCancelSave").onclick = () => area.classList.add("hidden");
    area.querySelector("#btnSaveAll").onclick = async () => {
      if (extractedItems.length === 0) {
        Toast.warning("Không có dữ liệu để lưu");
        return;
      }
      try {
        const payload = extractedItems.map(it => ({
          subject_name: it.subject_name,
          subject_code: it.subject_code || null,
          teacher: it.teacher || null,
          room: it.room || null,
          day_of_week: parseInt(it.day_of_week) || 2,
          start_time: (it.start_time || "07:00") + (it.start_time?.length === 5 ? ":00" : ""),
          end_time: (it.end_time || "09:25") + (it.end_time?.length === 5 ? ":00" : ""),
          weeks: it.weeks || null,
        }));
        await API.createBulkSchedules(payload);
        Toast.success(`Đã lưu ${payload.length} buổi học vào lịch`);
        setTimeout(() => navigateTo("schedule"), 1000);
      } catch (err) {
        Toast.error(err.message);
      }
    };
  }

  function renderTranscriptResults(area) {
    area.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">3. Xác nhận và chỉnh sửa điểm</h3>
          <span class="badge badge-success">${extractedItems.length} môn</span>
        </div>
        <div class="alert alert-warning">
          ⚠ Hãy kiểm tra dữ liệu trích xuất bên dưới. Bạn có thể chỉnh sửa, xóa hoặc thêm trước khi lưu.
        </div>
        <div class="table-wrap">
          <table class="table" id="ocrTable">
            <thead>
              <tr>
                <th>Mã môn</th><th>Tên môn</th><th>TC</th><th>HK</th>
                <th>QT</th><th>GK</th><th>CK</th><th>Tổng /10</th><th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <div class="flex justify-end gap-2 mt-4">
          <button class="btn btn-secondary" id="btnCancelSave">Hủy</button>
          <button class="btn btn-primary" id="btnSaveAll">💾 Lưu toàn bộ vào hệ thống</button>
        </div>
      </div>
    `;

    const tbody = area.querySelector("tbody");
    function renderRows() {
      tbody.innerHTML = "";
      extractedItems.forEach((item, idx) => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td><input class="form-control" style="padding:4px;font-size:12px;width:90px" data-field="subject_code" data-idx="${idx}" value="${escapeHtml(item.subject_code||"")}"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;min-width:200px" data-field="subject_name" data-idx="${idx}" value="${escapeHtml(item.subject_name||"")}"></td>
          <td><input type="number" class="form-control" style="padding:4px;font-size:12px;width:55px" data-field="credits" data-idx="${idx}" value="${item.credits||3}" min="1"></td>
          <td><input class="form-control" style="padding:4px;font-size:12px;width:80px" data-field="semester" data-idx="${idx}" value="${escapeHtml(item.semester||"")}"></td>
          <td><input type="number" class="form-control" style="padding:4px;font-size:12px;width:60px" data-field="process_score" data-idx="${idx}" value="${item.process_score ?? ""}" step="0.1" min="0" max="10"></td>
          <td><input type="number" class="form-control" style="padding:4px;font-size:12px;width:60px" data-field="midterm_score" data-idx="${idx}" value="${item.midterm_score ?? ""}" step="0.1" min="0" max="10"></td>
          <td><input type="number" class="form-control" style="padding:4px;font-size:12px;width:60px" data-field="final_score" data-idx="${idx}" value="${item.final_score ?? ""}" step="0.1" min="0" max="10"></td>
          <td><input type="number" class="form-control" style="padding:4px;font-size:12px;width:65px;font-weight:700" data-field="total_score_10" data-idx="${idx}" value="${item.total_score_10 ?? ""}" step="0.01" min="0" max="10"></td>
          <td><button class="btn btn-ghost btn-sm" data-remove="${idx}">🗑</button></td>
        `;
        tbody.appendChild(row);
      });
      tbody.querySelectorAll("[data-field]").forEach(el => {
        el.onchange = () => {
          const idx = parseInt(el.dataset.idx);
          let val = el.value;
          if (el.type === "number") val = val === "" ? null : parseFloat(val);
          extractedItems[idx][el.dataset.field] = val;
        };
      });
      tbody.querySelectorAll("[data-remove]").forEach(b => {
        b.onclick = () => {
          extractedItems.splice(parseInt(b.dataset.remove), 1);
          renderRows();
        };
      });
    }
    renderRows();

    area.querySelector("#btnCancelSave").onclick = () => area.classList.add("hidden");
    area.querySelector("#btnSaveAll").onclick = async () => {
      if (extractedItems.length === 0) {
        Toast.warning("Không có dữ liệu để lưu");
        return;
      }
      try {
        const payload = extractedItems.map(it => ({
          subject_code: it.subject_code || null,
          subject_name: it.subject_name,
          credits: parseInt(it.credits) || 3,
          semester: it.semester || null,
          process_score: it.process_score ?? null,
          midterm_score: it.midterm_score ?? null,
          final_score: it.final_score ?? null,
          total_score_10: it.total_score_10 ?? null,
        }));
        await API.createBulkSubjects(payload);
        Toast.success(`Đã lưu ${payload.length} môn học vào hệ thống`);
        setTimeout(() => navigateTo("gpa"), 1000);
      } catch (err) {
        Toast.error(err.message);
      }
    };
  }
};
