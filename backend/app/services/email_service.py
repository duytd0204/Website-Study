"""
Email Service - viết theo OOP.

Lớp EmailService đóng gói: gửi OTP, gửi nhắc lịch học, dev-mode console fallback.

Nguyên lý OOP:
  * Encapsulation – cấu hình SMTP và template HTML nằm trong class
  * Abstraction   – caller chỉ gọi send_otp()/send_reminder()
"""
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from app.core.config import settings


class EmailService:
    """Dịch vụ gửi email cho hệ thống TLU Learning Support."""

    @property
    def is_configured(self) -> bool:
        return bool(settings.SMTP_USER and settings.SMTP_PASSWORD)

    def _send(self, to_email: str, subject: str, html_body: str) -> bool:
        if not self.is_configured:
            print("=" * 60)
            print("[DEV MODE - EMAIL] SMTP chưa cấu hình.")
            print(f"  To      : {to_email}")
            print(f"  Subject : {subject}")
            print("=" * 60)
            return True

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

    def _otp_template(self, full_name: str, otp_code: str) -> str:
        return f"""
        <div style="font-family:'Be Vietnam Pro',Arial,sans-serif;max-width:520px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#003F87,#0066CC);color:white;
                      padding:28px 32px;border-radius:12px 12px 0 0;text-align:center">
            <h1 style="margin:0;font-size:22px">Đại học Thủy lợi</h1>
            <p style="margin:4px 0 0;opacity:.85">TLU Learning Support</p>
          </div>
          <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;
                      border-top:none;border-radius:0 0 12px 12px">
            <p>Xin chào <b>{full_name}</b>,</p>
            <p>Mã xác thực (OTP) của bạn là:</p>
            <div style="font-size:38px;font-weight:900;letter-spacing:10px;
                        color:#003F87;text-align:center;padding:20px 0">{otp_code}</div>
            <p style="color:#dc2626">Mã có hiệu lực trong <b>15 phút</b>. Không chia sẻ mã này.</p>
          </div>
        </div>"""

    def _reminder_template(self, full_name: str, upcoming: list) -> str:
        rows = "".join(f"""
          <tr style="border-bottom:1px solid #eee">
            <td style="padding:10px 14px"><b>{c.get('subject_name','')}</b></td>
            <td style="padding:10px 14px">{c.get('start_time','')[:5]} – {c.get('end_time','')[:5]}</td>
            <td style="padding:10px 14px">{c.get('room') or '—'}</td>
            <td style="padding:10px 14px">{c.get('teacher') or '—'}</td>
            <td style="padding:10px 14px;color:#003F87;font-weight:600">
              {'Còn ' + str(c.get('minutes_until','')) + ' phút' if c.get('minutes_until') else ''}
            </td>
          </tr>""" for c in upcoming)
        return f"""
        <div style="font-family:'Be Vietnam Pro',Arial,sans-serif;max-width:600px;margin:0 auto">
          <div style="background:linear-gradient(135deg,#003F87,#0066CC);color:white;
                      padding:28px 32px;border-radius:12px 12px 0 0">
            <h1 style="margin:0;font-size:22px">Nhắc nhở lịch học</h1>
            <p style="margin:8px 0 0;opacity:.85">Đại học Thủy lợi – TLU Learning Support</p>
          </div>
          <div style="background:#fff;padding:28px 32px;border:1px solid #e2e8f0;
                      border-top:none;border-radius:0 0 12px 12px">
            <p>Xin chào <b>{full_name}</b>,</p>
            <p>Bạn có <b>{len(upcoming)}</b> buổi học trong 24 giờ tới:</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;font-size:14px">
              <thead><tr style="background:#f4f6f9">
                <th style="padding:10px 14px;text-align:left">Môn học</th>
                <th style="padding:10px 14px;text-align:left">Giờ</th>
                <th style="padding:10px 14px;text-align:left">Phòng</th>
                <th style="padding:10px 14px;text-align:left">Giảng viên</th>
                <th style="padding:10px 14px;text-align:left">Còn lại</th>
              </tr></thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        </div>"""

    def send_otp(self, to_email: str, otp_code: str, full_name: str = "") -> bool:
        if not self.is_configured:
            print("=" * 60)
            print("[DEV MODE] OTP gửi tới console thay vì email:")
            print(f"  Email : {to_email}")
            print(f"  OTP   : {otp_code}")
            print("=" * 60)
            return True
        html = self._otp_template(full_name or to_email, otp_code)
        return self._send(to_email, "Mã xác thực – TLU Learning Support", html)

    async def send_reminder(self, to_email: str, full_name: str, upcoming: list):
        html = self._reminder_template(full_name, upcoming)
        self._send(to_email, f"Nhắc nhở: {len(upcoming)} buổi học trong 24h tới – TLU", html)


email_service = EmailService()
