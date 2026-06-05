"""
Service gửi Email cho chức năng Quên mật khẩu.
Sử dụng SMTP. Nếu chưa cấu hình SMTP, sẽ in OTP ra console (dev mode).
"""
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from app.core.config import settings


def send_otp_email(to_email: str, otp_code: str, full_name: str = "") -> bool:
    """
    Gửi email chứa mã OTP để reset mật khẩu.
    Trả về True nếu thành công.
    """
    subject = "[TLU Learning Support] Mã xác thực đặt lại mật khẩu"

    html_body = f"""
    <!DOCTYPE html>
    <html lang="vi">
    <head><meta charset="UTF-8"></head>
    <body style="font-family: Arial, sans-serif; background:#f4f6f9; padding:20px;">
      <div style="max-width:600px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; box-shadow:0 2px 8px rgba(0,0,0,0.08);">
        <div style="background:linear-gradient(135deg,#003F87,#0066CC); color:#fff; padding:24px 30px;">
          <h1 style="margin:0; font-size:22px;">Đại học Thủy lợi</h1>
          <p style="margin:4px 0 0; opacity:0.9; font-size:14px;">Hệ thống Hỗ trợ Quản lý Học tập</p>
        </div>
        <div style="padding:30px;">
          <h2 style="color:#003F87; font-size:20px; margin-top:0;">Xin chào {full_name or "bạn"},</h2>
          <p style="color:#333; font-size:15px; line-height:1.6;">
            Bạn vừa yêu cầu đặt lại mật khẩu cho tài khoản TLU Learning Support.<br>
            Vui lòng nhập mã xác thực dưới đây vào hệ thống để tiếp tục:
          </p>
          <div style="text-align:center; margin:30px 0;">
            <div style="display:inline-block; background:#003F87; color:#fff; font-size:32px; font-weight:bold; letter-spacing:8px; padding:16px 32px; border-radius:8px;">
              {otp_code}
            </div>
          </div>
          <p style="color:#666; font-size:13px;">
            Mã xác thực có hiệu lực trong <b>15 phút</b>. Không chia sẻ mã này cho bất kỳ ai.
          </p>
          <p style="color:#999; font-size:12px; margin-top:30px;">
            Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.
          </p>
        </div>
        <div style="background:#f4f6f9; padding:16px 30px; text-align:center; font-size:12px; color:#888;">
          © 2026 Trường Đại học Thủy lợi - 175 Tây Sơn, Đống Đa, Hà Nội
        </div>
      </div>
    </body>
    </html>
    """

    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        # Dev mode: in OTP ra console
        print("=" * 60)
        print("[DEV MODE - EMAIL] SMTP chưa cấu hình. OTP gửi tới console:")
        print(f"To: {to_email}")
        print(f"OTP: {otp_code}")
        print("=" * 60)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = formataddr((settings.SMTP_FROM_NAME, settings.SMTP_USER))
        msg["To"] = to_email
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
        return True
    except Exception as e:
        print(f"[Email Service] Lỗi gửi email: {e}")
        return False
