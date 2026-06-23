/**
 * BaseView - lớp trừu tượng (abstract class) làm nền cho mọi "trang"
 * (view) trong ứng dụng: Dashboard, Schedule, GPA, Curriculum, Notes,
 * OCR, Chatbot, Profile.
 *
 * Nguyên lý OOP minh hoạ ở đây:
 *   - Abstraction   : định nghĩa method render() nhưng không triển khai,
 *                     bắt buộc lớp con phải tự viết (giống "interface").
 *   - Inheritance   : mọi *View class kế thừa (extends) BaseView để
 *                     dùng chung các helper (setHTML, $, $all...).
 *   - Polymorphism  : AppShell chỉ gọi `VIEWS[name](container)` —
 *                     không cần biết bên trong là DashboardView hay
 *                     ChatbotView, mỗi lớp tự "render" theo cách riêng.
 */
class BaseView {
  constructor(container) {
    if (this.constructor === BaseView) {
      throw new Error("BaseView là lớp trừu tượng, không thể khởi tạo trực tiếp. Hãy tạo lớp con kế thừa nó.");
    }
    this.container = container;
  }

  /** Phương thức "trừu tượng". Lớp con BẮT BUỘC phải override. */
  async render() {
    throw new Error(`Lớp ${this.constructor.name} phải tự triển khai phương thức render()`);
  }

  setHTML(html)         { this.container.innerHTML = html; }
  $(selector)           { return this.container.querySelector(selector); }
  $all(selector)        { return this.container.querySelectorAll(selector); }
  get currentUser()     { return AuthHelper.getCurrentUser(); }

  /**
   * Đăng ký 1 ViewClass vào router toàn cục window.VIEWS.
   * Static factory method – gọi trực tiếp từ class, không cần new trước:
   *     BaseView.register("dashboard", DashboardView);
   */
  static register(name, ViewClass) {
    window.VIEWS = window.VIEWS || {};
    window.VIEWS[name] = (container) => new ViewClass(container).render();
  }
}

window.BaseView = BaseView;
