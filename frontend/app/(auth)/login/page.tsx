"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  MessageSquare,
  Bot,
  BarChart3,
  CalendarCheck,
  ArrowRight,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import "../../landing.css";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const features = [
  {
    icon: MessageSquare,
    title: "WhatsApp Automation",
    desc: "Capture, qualify, and reply from one clinic inbox.",
  },
  {
    icon: Bot,
    title: "AI Patient Agents",
    desc: "Specialists for leads, sales, follow-up, and booking.",
  },
  {
    icon: BarChart3,
    title: "Growth Analytics",
    desc: "Trace campaigns from first message to booked patients.",
  },
  {
    icon: CalendarCheck,
    title: "Appointment Flow",
    desc: "Keep reminders, bookings, and pipeline context together.",
  },
];

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", remember: false });

  const { setAuth } = useAuthStore();

  const handleGoogleSignIn = () => {
    toast.info("Google sign-in is not configured yet. Please use email and password for now.");
  };

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
    <div className="clinicovia-landing min-h-screen overflow-hidden bg-[color:var(--cream)]">
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        {/* Brand panel */}
        <div
          className="relative hidden min-h-screen overflow-hidden px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-14"
          style={{
            background:
              "linear-gradient(145deg, var(--navy-deep) 0%, var(--navy) 54%, #0e7490 130%)",
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(255,255,255,0.42) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.42) 1px, transparent 1px)",
              backgroundSize: "42px 42px",
            }}
          />

          <Link href="/" className="relative z-10 inline-flex w-fit" aria-label="Clinicovia home">
            <img className="h-auto w-44" src="/whitelogo.webp" alt="Clinicovia" />
          </Link>

          <div className="relative z-10 max-w-xl">
            <div className="eyebrow text-white/70">
              <span className="dot" />
              Clinic growth operating system
            </div>
            <h1 className="serif mt-6 text-[clamp(42px,5vw,76px)] font-normal leading-[0.98] text-white">
              Welcome back to your WhatsApp-first clinic command center.
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-8 text-white/72">
              Manage conversations, agents, appointments, pipeline, and attribution from
              the same workspace your team uses every day.
            </p>
          </div>

          <div className="relative z-10 grid gap-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.075] p-4 shadow-[0_18px_60px_rgba(0,0,0,0.12)] backdrop-blur"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-[color:var(--teal-soft)]">
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="font-semibold text-white">{feature.title}</p>
                    <p className="mt-1 text-sm leading-6 text-white/62">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="relative z-10 rounded-3xl border border-white/10 bg-white/[0.075] p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--teal-soft)] text-[color:var(--navy)]">
                <Sparkles className="h-5 w-5" strokeWidth={1.8} />
              </div>
              <div>
                <p className="font-semibold text-white">AI orchestration is live</p>
                <p className="text-sm text-white/62">Agents coordinate with your team, not around it.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Login form panel */}
        <div className="relative flex min-h-screen w-full items-center justify-center px-5 py-8 sm:px-8">
          <div className="relative w-full max-w-[460px]">
            <div className="mb-10 flex items-center justify-between gap-4 lg:hidden">
              <Link href="/" aria-label="Clinicovia home">
                <img className="h-auto w-40" src="/logo.webp" alt="Clinicovia" />
              </Link>
              <Link
                href="/"
                className="rounded-full border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                Home
              </Link>
            </div>

            <div className="mb-8 hidden lg:block">
              <Link href="/" aria-label="Clinicovia home">
                <img className="h-auto w-44" src="/logo.webp" alt="Clinicovia" />
              </Link>
            </div>

            <div className="rounded-[28px] border bg-white/85 p-6 shadow-[0_24px_80px_rgba(12,53,105,0.10)] backdrop-blur sm:p-8" style={{ borderColor: "var(--line)" }}>
              <div className="mb-7">
                <div className="eyebrow">
                  <span className="dot" />
                  Secure workspace
                </div>
                <h2 className="serif mt-4 text-4xl font-normal leading-tight" style={{ color: "var(--ink)" }}>
                  Sign in to Clinicovia
                </h2>
                <p className="mt-3 text-base leading-7" style={{ color: "var(--muted)" }}>
                  Continue to your clinic dashboard, patient inbox, and AI agent controls.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="email" className="mb-2 block text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                    <input
                      id="email"
                      type="email"
                      placeholder="you@clinic.com"
                      required
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="h-12 w-full rounded-2xl border bg-white pl-11 pr-4 text-[15px] outline-none transition"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--teal)";
                        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(14,116,144,0.10)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--line)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="mb-2 block text-sm font-semibold" style={{ color: "var(--ink)" }}>
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--muted)" }} />
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      required
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      className="h-12 w-full rounded-2xl border bg-white pl-11 pr-12 text-[15px] outline-none transition"
                      style={{ borderColor: "var(--line)", color: "var(--ink)" }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--teal)";
                        e.currentTarget.style.boxShadow = "0 0 0 4px rgba(14,116,144,0.10)";
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--line)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                    />
                    <button
                      type="button"
                      className="absolute right-4 top-1/2 -translate-y-1/2 transition"
                      style={{ color: "var(--muted)" }}
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor="remember" className="flex cursor-pointer items-center gap-2 text-sm" style={{ color: "var(--muted)" }}>
                    <input
                      id="remember"
                      type="checkbox"
                      checked={form.remember}
                      onChange={(e) => setForm({ ...form, remember: e.target.checked })}
                      className="h-4 w-4 rounded border"
                      style={{ accentColor: "var(--teal)" }}
                    />
                    Keep me signed in
                  </label>
                  <Link href="/forgot-password" className="text-sm font-semibold transition hover:opacity-75" style={{ color: "var(--teal)" }}>
                    Forgot password?
                  </Link>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold text-white shadow-[0_18px_42px_rgba(12,53,105,0.18)] transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-65"
                  style={{ background: "var(--navy)" }}
                >
                  {loading ? "Signing in..." : "Sign in"}
                  {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>

              <div className="my-6 flex items-center gap-4">
                <div className="h-px flex-1" style={{ background: "var(--line)" }} />
                <span className="text-xs font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
                  or
                </span>
                <div className="h-px flex-1" style={{ background: "var(--line)" }} />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="flex h-12 w-full items-center justify-center gap-3 rounded-full border bg-white px-5 text-sm font-semibold transition hover:-translate-y-0.5"
                style={{ borderColor: "var(--line)", color: "var(--ink)" }}
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
                </svg>
                Continue with Google
              </button>

              <div className="mt-6 flex items-start gap-3 rounded-2xl p-4" style={{ background: "var(--cream)", color: "var(--muted)" }}>
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "var(--teal)" }} />
                <p className="text-sm leading-6">
                  Your workspace is protected with clinic-scoped access and secure session tokens.
                </p>
              </div>
            </div>

            <p className="mt-7 text-center text-sm" style={{ color: "var(--muted)" }}>
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold transition hover:opacity-75" style={{ color: "var(--teal)" }}>
                Start free trial
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
