"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsPending(true);
    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });
    const data = (await response.json()) as { message?: string };

    if (!response.ok) {
      setError(data.message ?? "Không thể tạo tài khoản");
      setIsPending(false);
      return;
    }

    router.push("/login?registered=1");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label>
        Họ và tên
        <input name="name" autoComplete="name" minLength={2} required />
      </label>
      <label>
        Email
        <input name="email" type="email" autoComplete="email" required />
      </label>
      <label>
        Mật khẩu
        <input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button className="primary-button" disabled={isPending} type="submit">
        {isPending ? <LoaderCircle className="spin" size={18} /> : null}
        Tạo tài khoản
        {!isPending ? <ArrowRight size={18} /> : null}
      </button>
      <p className="auth-switch">
        Đã có tài khoản? <Link href="/login">Đăng nhập</Link>
      </p>
    </form>
  );
}
