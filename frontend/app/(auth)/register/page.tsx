"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock, User, Building2, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLINIC_TYPES, COUNTRY_CODES } from "@/lib/constants";

function InputWithIcon({
  Icon,
  ...props
}: { Icon?: React.ComponentType<{ className?: string }> } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="relative">
      {Icon && (
        <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
      )}
      <Input className={Icon ? "pl-9" : undefined} {...props} />
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    clinicName: "",
    clinicType: "",
    email: "",
    countryCode: "+212",
    phone: "",
    password: "",
    confirmPassword: "",
    country: "",
    city: "",
    agreeTerms: false,
  });

  const updateForm = (key: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!form.agreeTerms) {
      toast.error("Please agree to the Terms of Service");
      return;
    }
    setLoading(true);
    try {
      // TODO: replaced by Clerk SignUp in W1.4
      toast.success("Account created! Please verify your email.");
      router.push("/login");
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: "", color: "" };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score, label: "Weak", color: "bg-[var(--danger)]" };
    if (score <= 2) return { score, label: "Medium", color: "bg-[var(--warning)]" };
    return { score, label: "Strong", color: "bg-[var(--success)]" };
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-12">
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-8 shadow-card">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold text-white"
              style={{ backgroundColor: "var(--primary-light)" }}
            >
              C
            </div>
            <span className="text-xl font-bold text-[var(--primary)]">Clinicovia</span>
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Create Your Clinic Account</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Get started in 2 minutes — no credit card required
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <InputWithIcon
                id="firstName"
                Icon={User}
                placeholder="First name"
                required
                value={form.firstName}
                onChange={(e) => updateForm("firstName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                placeholder="Last name"
                required
                value={form.lastName}
                onChange={(e) => updateForm("lastName", e.target.value)}
              />
            </div>
          </div>

          {/* Clinic */}
          <div className="space-y-2">
            <Label htmlFor="clinicName">Clinic Name</Label>
            <InputWithIcon
              id="clinicName"
              Icon={Building2}
              placeholder="Your clinic name"
              required
              value={form.clinicName}
              onChange={(e) => updateForm("clinicName", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="clinicType">Clinic Type</Label>
            <Select
              value={form.clinicType}
              onValueChange={(v) => updateForm("clinicType", v)}
            >
              <SelectTrigger id="clinicType">
                <SelectValue placeholder="Select clinic type..." />
              </SelectTrigger>
              <SelectContent>
                {CLINIC_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Contact */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <InputWithIcon
              id="email"
              type="email"
              Icon={Mail}
              placeholder="you@clinic.com"
              required
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <div className="flex gap-2">
              <Select
                value={form.countryCode}
                onValueChange={(v) => updateForm("countryCode", v)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <InputWithIcon
                id="phone"
                type="tel"
                Icon={Phone}
                placeholder="6 12 34 56 78"
                className="flex-1"
                required
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <InputWithIcon
              id="password"
              type="password"
              Icon={Lock}
              placeholder="Create a strong password"
              required
              value={form.password}
              onChange={(e) => updateForm("password", e.target.value)}
            />
            {form.password && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1.5 flex-1 rounded-full ${
                        i <= strength.score ? strength.color : "bg-gray-200"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <InputWithIcon
              id="confirmPassword"
              type="password"
              Icon={Lock}
              placeholder="Confirm your password"
              required
              value={form.confirmPassword}
              onChange={(e) => updateForm("confirmPassword", e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="country">Country</Label>
              <Select
                value={form.country}
                onValueChange={(v) => updateForm("country", v)}
              >
                <SelectTrigger id="country">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((c) => (
                    <SelectItem key={c.country} value={c.country}>
                      {c.country}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <Input
                id="city"
                placeholder="City"
                value={form.city}
                onChange={(e) => updateForm("city", e.target.value)}
              />
            </div>
          </div>

          {/* Terms */}
          <div className="flex items-start gap-2">
            <Checkbox
              id="terms"
              checked={form.agreeTerms}
              onCheckedChange={(checked) => updateForm("agreeTerms", checked === true)}
            />
            <Label htmlFor="terms" className="text-sm leading-5">
              I agree to the{" "}
              <a href="#" className="font-medium text-[var(--primary-light)]">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-medium text-[var(--primary-light)]">
                Privacy Policy
              </a>
            </Label>
          </div>

          <Button
            type="submit"
            disabled={loading}
            size="lg"
            className="w-full bg-[var(--primary-light)] hover:bg-[var(--primary-light)]/90"
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <ArrowRight className="h-4 w-4" />}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-[var(--primary-light)]">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
