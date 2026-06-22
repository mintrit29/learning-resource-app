import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <div className="auth-content">
      <div>
        <p className="eyebrow">Bắt đầu thư viện mới</p>
        <h2>Tạo tài khoản</h2>
        <p>Mỗi tài khoản có không gian tài liệu và project riêng.</p>
      </div>
      <RegisterForm />
    </div>
  );
}
