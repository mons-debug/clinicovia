"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Label, TextInput, Select, Checkbox } from "flowbite-react";
import { Mail, Lock, User, Building2, Phone, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { CLINIC_TYPES, COUNTRY_CODES } from "@/lib/constants";

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    clinicName: "",
    clinicType: "",
    email: "",
    countryCode: "+971",
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
      // TODO: Connect to backend in Phase 1.1
      toast.success("Account created! Please verify your email.");
      router.push("/login");
    } catch {
      toast.error("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Password strength
  const getPasswordStrength = () => {
    const p = form.password;
    if (!p) return { score: 0, label: "", color: "" };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[0-9]/.test(p)) score++;
    if (/[^A-Za-z0-9]/.test(p)) score++;
    if (score <= 1) return { score, label: "Weak", color: "bg-danger" };
    if (score <= 2) return { score, label: "Medium", color: "bg-warning" };
    return { score, label: "Strong", color: "bg-success" };
  };

  const strength = getPasswordStrength();

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50/50 px-4 py-12">
      <div className="w-full max-w-[560px] rounded-2xl bg-white p-8 shadow-card">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="mb-4 flex items-center justify-center gap-2">
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
          <h2 className="text-2xl font-bold text-text-primary">Create Your Clinic Account</h2>
          <p className="mt-1 text-sm text-text-secondary">Get started in 2 minutes — no credit card required</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="mb-2 block">First Name</Label>
              <TextInput
                id="firstName"
                icon={User}
                placeholder="First name"
                required
                value={form.firstName}
                onChange={(e) => updateForm("firstName", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="lastName" className="mb-2 block">Last Name</Label>
              <TextInput
                id="lastName"
                placeholder="Last name"
                required
                value={form.lastName}
                onChange={(e) => updateForm("lastName", e.target.value)}
              />
            </div>
          </div>

          {/* Clinic */}
          <div>
            <Label htmlFor="clinicName" className="mb-2 block">Clinic Name</Label>
            <TextInput
              id="clinicName"
              icon={Building2}
              placeholder="Your clinic name"
              required
              value={form.clinicName}
              onChange={(e) => updateForm("clinicName", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="clinicType" className="mb-2 block">Clinic Type</Label>
            <Select
              id="clinicType"
              required
              value={form.clinicType}
              onChange={(e) => updateForm("clinicType", e.target.value)}
            >
              <option value="">Select clinic type...</option>
              {CLINIC_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </Select>
          </div>

          {/* Contact */}
          <div>
            <Label htmlFor="email" className="mb-2 block">Email</Label>
            <TextInput
              id="email"
              type="email"
              icon={Mail}
              placeholder="you@clinic.com"
              required
              value={form.email}
              onChange={(e) => updateForm("email", e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="phone" className="mb-2 block">Phone</Label>
            <div className="flex gap-2">
              <Select
                className="w-32"
                value={form.countryCode}
                onChange={(e) => updateForm("countryCode", e.target.value)}
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.code}
                  </option>
                ))}
              </Select>
              <TextInput
                id="phone"
                type="tel"
                icon={Phone}
                placeholder="50 123 4567"
                className="flex-1"
                required
                value={form.phone}
                onChange={(e) => updateForm("phone", e.target.value)}
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="mb-2 block">Password</Label>
            <TextInput
              id="password"
              type="password"
              icon={Lock}
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
                <p className="mt-1 text-xs text-text-secondary">{strength.label}</p>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="mb-2 block">Confirm Password</Label>
            <TextInput
              id="confirmPassword"
              type="password"
              icon={Lock}
              placeholder="Confirm your password"
              required
              value={form.confirmPassword}
              onChange={(e) => updateForm("confirmPassword", e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country" className="mb-2 block">Country</Label>
              <Select
                id="country"
                value={form.country}
                onChange={(e) => updateForm("country", e.target.value)}
              >
                <option value="">Select country</option>
                {COUNTRY_CODES.map((c) => (
                  <option key={c.country} value={c.country}>{c.country}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="city" className="mb-2 block">City</Label>
              <TextInput
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
              onChange={(e) => updateForm("agreeTerms", e.target.checked)}
            />
            <Label htmlFor="terms" className="text-sm">
              I agree to the{" "}
              <a href="#" className="font-medium" style={{ color: "var(--primary-light)" }}>
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="font-medium" style={{ color: "var(--primary-light)" }}>
                Privacy Policy
              </a>
            </Label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="group flex w-full items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: "var(--primary-light)" }}
          >
            {loading ? "Creating account..." : "Create Account"}
            {!loading && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-semibold"
            style={{ color: "var(--primary-light)" }}
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
