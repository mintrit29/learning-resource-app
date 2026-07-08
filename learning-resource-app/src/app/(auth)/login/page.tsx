import { LoginForm } from "@/components/auth/login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  const params = await searchParams;
  const registered = params.registered === "1";

  return (
    <div className="auth-content">
      <div>
        <p className="eyebrow">Chào mừng trở lại</p>
        <h2>Đăng nhập</h2>
        <p>Tiếp tục quản lý thư viện nghiên cứu của bạn.</p>
      </div>
      {registered ? (
        <div className="success-notice" role="status">
          <strong>Tạo tài khoản thành công</strong>
          <span>Đăng nhập để bắt đầu thêm tài liệu đầu tiên.</span>
        </div>
      ) : null}
      <LoginForm />
    </div>
  );
}
