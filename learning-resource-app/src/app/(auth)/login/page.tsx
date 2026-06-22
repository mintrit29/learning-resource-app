import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage() {
  return (
    <div className="auth-content">
      <div>
        <p className="eyebrow">Chào mừng trở lại</p>
        <h2>Đăng nhập</h2>
        <p>Tiếp tục quản lý thư viện nghiên cứu của bạn.</p>
      </div>
      <LoginForm />
    </div>
  );
}
