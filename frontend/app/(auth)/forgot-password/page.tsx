"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail, KeyRound, ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@clinic.com"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                size="lg"
                className="w-full bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/90"
              >
                {loading ? "Sending..." : "Send Reset Link"}
                {!loading && <ArrowRight className="h-4 w-4" />}
              </Button>
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
              <Button
                variant="secondary"
                className="w-full"
                onClick={() => window.open("mailto:", "_blank")}
              >
                Open Email App
              </Button>
              <Button
                variant="link"
                className="text-[var(--primary-light)]"
                onClick={() => {
                  setSent(false);
                  toast.info("You can resend the link.");
                }}
              >
                Didn&apos;t receive it? Resend
              </Button>
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
