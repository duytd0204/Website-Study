/**
 * Cấu hình toàn cục cho Frontend
 */
window.APP_CONFIG = {
  // Khi backend phục vụ frontend cùng port → để rỗng
  // Nếu chạy frontend riêng (vd: live-server) thì set: "http://localhost:8000"
  API_BASE: "",
  APP_NAME: "TLU Learning Support",
  TLU_NAME: "Đại học Thủy lợi",
  TOKEN_KEY: "tlu_access_token",
  USER_KEY: "tlu_user",
};

// Auto-detect khi frontend được phục vụ tách rời
if (location.port === '5500' || location.port === '5173' || location.port === '3000') {
  window.APP_CONFIG.API_BASE = "http://localhost:8000";
}
