"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Label, TextInput } from "flowbite-react";
import { Mail, KeyRound, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // TODO: Connect to backend in Phase 1.1
      setSent(true);
      toast.success("Reset link sent!");
    } catch {
      toast.error("Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 px-4">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 shadow-card text-center">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ backgroundColor: "#3EC8A0" }}
          >
            C
          </div>
          <span className="text-xl font-bold" style={{ color: "var(--primary)" }}>
            Clinicovia
          </span>
        </div>

        {!sent ? (
          <>
            <div className="flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "var(--primary-lighter)" }}
              >
                <KeyRound className="h-7 w-7" style={{ color: "var(--primary)" }} />
              </div>
            </div>

            <h2 className="mt-5 text-2xl font-bold text-text-primary">Reset Your Password</h2>
            <p className="mt-2 text-sm text-text-secondary">
              Enter your email and we&apos;ll send you a reset link
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-left">
              <div>
                <Label htmlFor="email" className="mb-2 block">Email address</Label>
                <TextInput
                  id="email"
                  type="email"
                  icon={Mail}
                  placeholder="you@clinic.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: "var(--primary-light)" }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
                {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="flex justify-center">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl"
                style={{ backgroundColor: "var(--primary-lighter)" }}
              >
                <Mail className="h-7 w-7" style={{ color: "var(--primary)" }} />
              </div>
            </div>

            <h2 className="mt-5 text-2xl font-bold text-text-primary">Check Your Email</h2>
            <p className="mt-2 text-sm text-text-secondary">
              We sent a reset link to{" "}
              <span className="font-semibold text-text-primary">
                {email.replace(/(.{2}).*(@.*)/, "$1***$2")}
              </span>
            </p>

            <div className="mt-6 space-y-3">
              <button
                className="w-full rounded-lg border border-border bg-gray-50 px-5 py-3 text-sm font-medium text-text-primary transition-colors hover:bg-gray-100"
                onClick={() => window.open("mailto:", "_blank")}
              >
                Open Email App
              </button>
              <button
                className="text-sm font-medium transition-opacity hover:opacity-80"
                style={{ color: "var(--primary-light)" }}
                onClick={() => {
                  setSent(false);
                  toast.info("You can resend the link.");
                }}
              >
                Didn&apos;t receive it? Resend
              </button>
            </div>
          </>
        )}

        <div className="mt-8">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
