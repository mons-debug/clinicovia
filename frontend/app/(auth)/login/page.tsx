"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "flowbite-react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  MessageSquare,
  Bot,
  BarChart3,
  CalendarCheck,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const features = [
  {
    icon: MessageSquare,
    title: "WhatsApp Automation",
    desc: "AI handles 80% of patient inquiries automatically",
  },
  {
    icon: Bot,
    title: "AI Agents",
    desc: "6 specialized agents for reception, sales & booking",
  },
  {
    icon: BarChart3,
    title: "Smart Analytics",
    desc: "Real-time pipeline and revenue insights",
  },
  {
    icon: CalendarCheck,
    title: "Appointment Booking",
    desc: "Seamless scheduling with automated reminders",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", remember: false });

  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email.trim(), password: form.password.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        throw new Error(err.detail || "Invalid email or password");
      }
      const data = await res.json();
      const u = data.user;
      const memberships = (data.memberships || []).map((m: { clinic_id: string; role: string; clinic_name: string }) => ({
        clinicId: m.clinic_id,
        role: m.role,
        clinic: {
          id: m.clinic_id,
          name: m.clinic_name,
          slug: "",
          plan: "professional",
          status: "active",
        },
      }));
      setAuth(
        {
          id: u.id,
          email: u.email,
          firstName: u.first_name,
          lastName: u.last_name,
          isVerified: u.is_verified,
          isSuperAdmin: u.is_super_admin,
        },
        data.tokens.access_token,
        data.tokens.refresh_token,
        memberships,
      );
      toast.success("Login successful!");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      {/* Left Panel — Branding */}
      <div
        className="hidden lg:flex lg:w-[45%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: "linear-gradient(145deg, #0D4F6C 0%, #0a3d56 50%, #0D4F6C 100%)" }}
      >
        {/* Subtle background pattern */}
        <div
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Accent blob */}
        <div
          className="absolute -top-32 -right-32 h-96 w-96 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3EC8A0, transparent)" }}
        />
        <div
          className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, #3EC8A0, transparent)" }}
        />

        {/* Logo */}
        <div className="relative">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "#3EC8A0" }}
            >
              C
            </div>
            <div>
              <p className="text-lg font-bold text-white">Clinicovia</p>
              <p className="text-xs text-white/60">AI-Powered Clinic Growth</p>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="relative space-y-3">
          <p className="mb-6 text-2xl font-semibold leading-snug text-white">
            The complete growth platform for modern clinics
          </p>
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="flex items-start gap-4 rounded-xl p-4"
                style={{ backgroundColor: "rgba(255,255,255,0.07)", backdropFilter: "blur(8px)" }}
              >
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: "rgba(62,200,160,0.2)" }}
                >
                  <Icon className="h-4 w-4" style={{ color: "#3EC8A0" }} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{f.title}</p>
                  <p className="text-xs text-white/60">{f.desc}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Testimonial */}
        <div
          className="relative rounded-2xl p-5"
          style={{ backgroundColor: "rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
        >
          <div className="flex gap-1 mb-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <TrendingUp key={i} className="h-3 w-3" style={{ color: "#3EC8A0" }} />
            ))}
          </div>
          <p className="text-sm text-white/90 italic leading-relaxed">
            &ldquo;Clinicovia doubled our bookings in 30 days. The AI agents handle 80% of inquiries automatically.&rdquo;
          </p>
          <div className="mt-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: "#3EC8A0" }}>
              DS
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Dr. Sarah Al-Mahmoud</p>
              <p className="text-xs text-white/60">Dubai Aesthetic Clinic</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Login Form */}
      <div className="flex w-full flex-col items-center justify-center bg-gray-50/50 px-8 lg:w-[55%]">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-2 lg:hidden">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
              style={{ backgroundColor: "#3EC8A0" }}
            >
              C
            </div>
            <span className="text-lg font-bold" style={{ color: "var(--primary)" }}>
              Clinicovia
            </span>
          </div>

          <h2 className="text-2xl font-bold text-text-primary">Welcome back</h2>
          <p className="mt-1 text-text-secondary">Sign in to your clinic dashboard</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-text-primary">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="email"
                  type="email"
                  placeholder="you@clinic.com"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-3 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-text-primary">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full rounded-lg border border-border bg-white py-2.5 pl-10 pr-10 text-sm placeholder:text-text-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={form.remember}
                  onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                />
                <label htmlFor="remember" className="text-sm text-text-secondary">
                  Keep me signed in
                </label>
              </div>
              <Link
                href="/forgot-password"
                className="text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--primary-light)" }}
              >
                Forgot password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              {loading ? "Signing in..." : "Sign In"}
              {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium uppercase tracking-wide text-text-muted">or continue with</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Social login */}
          <div>
            <button className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-gray-50">
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
          </div>

          <p className="mt-8 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/register"
              className="font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--primary-light)" }}
            >
              Contact Sales
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
