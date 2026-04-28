"use client";

import Link from "next/link";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  LineChart,
  MessageCircle,
  Quote,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Target,
  Users,
  Workflow,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
};

const features = [
  {
    icon: MessageCircle,
    title: "WhatsApp Automation",
    body:
      "Reply, qualify, and book patients on WhatsApp 24/7 with an AI agent that sounds like your front desk.",
  },
  {
    icon: Sparkles,
    title: "AI Patient Agents",
    body:
      "Multi-language conversational agents that understand intent, follow your scripts, and escalate when needed.",
  },
  {
    icon: Workflow,
    title: "Smart Pipeline",
    body:
      "A drag-and-drop CRM tuned for clinics — from first message to confirmed appointment, no leaks.",
  },
  {
    icon: CalendarCheck,
    title: "Calendar & Reminders",
    body:
      "Sync your team's calendar, send automated reminders, and watch your no-show rate fall.",
  },
  {
    icon: Target,
    title: "Conversion Tracking",
    body:
      "Server-side pixels for Meta, Google and TikTok so every booking ties back to the ad that drove it.",
  },
  {
    icon: LineChart,
    title: "Growth Analytics",
    body:
      "Daily revenue, response time, and pipeline velocity — the dashboard your marketing team will actually open.",
  },
];

const steps = [
  {
    title: "Connect",
    body:
      "Link your WhatsApp number, calendar, and ad accounts in minutes. No code, no IT ticket.",
  },
  {
    title: "Automate",
    body:
      "Train your AI agent on your services, prices, and tone. It handles inbound 24/7 while you sleep.",
  },
  {
    title: "Grow",
    body:
      "Watch booked appointments rise, no-shows drop, and ROAS climb — all from one dashboard.",
  },
];

const stats = [
  { value: "3.8x", label: "More booked appointments" },
  { value: "47%", label: "Fewer no-shows" },
  { value: "<30s", label: "Average WhatsApp reply time" },
  { value: "24/7", label: "Always-on patient support" },
];

export default function Home() {
  const prefersReducedMotion = useReducedMotion();

  const motionProps = prefersReducedMotion
    ? { initial: false, animate: undefined, whileInView: undefined }
    : {
        initial: "hidden" as const,
        whileInView: "show" as const,
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-text-primary">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[720px] overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            background:
              "radial-gradient(60% 60% at 50% 0%, rgba(62,200,160,0.18), transparent 60%), radial-gradient(40% 40% at 85% 10%, rgba(13,79,108,0.18), transparent 70%), radial-gradient(40% 40% at 10% 30%, rgba(139,92,246,0.10), transparent 70%)",
          }}
        />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(13,79,108,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(13,79,108,0.06) 1px, transparent 1px)",
            backgroundSize: "44px 44px",
            maskImage:
              "radial-gradient(ellipse at top, black 30%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Nav */}
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease }}
        className="relative z-10"
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-card"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
              }}
            >
              <Stethoscope className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <span className="text-lg font-semibold tracking-tight">
              Clinicovia
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm text-text-secondary md:flex">
            <a href="#features" className="transition hover:text-text-primary">
              Features
            </a>
            <a href="#how" className="transition hover:text-text-primary">
              How it works
            </a>
            <a href="#results" className="transition hover:text-text-primary">
              Results
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full px-4 py-2 text-sm font-medium text-text-secondary transition hover:text-text-primary sm:inline-flex"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              className="group inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-white shadow-card transition hover:shadow-card-hover"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary) 0%, #1B6F8E 100%)",
              }}
            >
              Get started
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </div>
      </motion.header>

      {/* Hero */}
      <section className="relative z-10">
        <div className="mx-auto grid max-w-6xl items-center gap-16 px-6 pb-24 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:pt-20">
          <motion.div variants={stagger} {...motionProps}>
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1 text-xs font-medium text-text-secondary backdrop-blur"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--primary-light)" }}
              />
              New — AI Orchestration is live
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-6 text-balance text-5xl font-semibold leading-[1.05] tracking-tight md:text-6xl"
            >
              Grow your clinic with{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{
                  backgroundImage:
                    "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
                }}
              >
                AI that books patients
              </span>{" "}
              for you.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 max-w-xl text-lg leading-relaxed text-text-secondary"
            >
              Clinicovia turns WhatsApp conversations, ad clicks, and missed
              calls into confirmed appointments — automatically. One platform
              for your front desk, marketing, and revenue.
            </motion.p>

            <motion.div
              variants={fadeUp}
              className="mt-9 flex flex-wrap items-center gap-3"
            >
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-card-hover transition hover:translate-y-[-1px]"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary) 0%, #1B6F8E 100%)",
                }}
              >
                Start free trial
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-6 py-3 text-sm font-semibold text-text-primary transition hover:border-text-muted"
              >
                Sign in
              </Link>
            </motion.div>

            <motion.ul
              variants={fadeUp}
              className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary"
            >
              {[
                "No credit card required",
                "14-day free trial",
                "Cancel anytime",
              ].map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2
                    className="h-4 w-4"
                    style={{ color: "var(--primary-light)" }}
                  />
                  {item}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* Hero visual */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 32 }}
            animate={prefersReducedMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.15 }}
            className="relative"
          >
            <HeroDashboard reduced={!!prefersReducedMotion} />
          </motion.div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="relative z-10 border-y border-border/70 bg-surface/60 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
            Trusted by modern clinics & medical groups
          </p>
          <motion.div
            variants={stagger}
            {...motionProps}
            className="mt-6 grid grid-cols-2 items-center gap-x-10 gap-y-6 text-text-muted sm:grid-cols-3 md:grid-cols-6"
          >
            {[
              "Aurora Medical",
              "Vivacare",
              "Lumière Clinic",
              "NovaSmile",
              "Helio Health",
              "Pulse Group",
            ].map((name) => (
              <motion.div
                key={name}
                variants={fadeUp}
                className="text-center text-sm font-semibold tracking-wide opacity-80"
              >
                {name}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <motion.div
            variants={stagger}
            {...motionProps}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.span
              variants={fadeUp}
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              Everything your clinic needs
            </motion.span>
            <motion.h2
              variants={fadeUp}
              className="mt-3 text-balance text-4xl font-semibold tracking-tight md:text-5xl"
            >
              One platform. Front desk to growth.
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="mt-4 text-pretty text-lg text-text-secondary"
            >
              Replace four tools with one. Clinicovia unifies messaging, CRM,
              calendar, and analytics around the patient journey.
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            {...motionProps}
            className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3"
          >
            {features.map(({ icon: Icon, title, body }) => (
              <motion.div
                key={title}
                variants={fadeUp}
                whileHover={
                  prefersReducedMotion
                    ? undefined
                    : { y: -4, transition: { duration: 0.25, ease } }
                }
                className="group relative overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-card transition hover:shadow-card-hover"
              >
                <div
                  aria-hidden
                  className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  style={{
                    background:
                      "radial-gradient(closest-side, rgba(62,200,160,0.18), transparent)",
                  }}
                />
                <div
                  className="relative flex h-11 w-11 items-center justify-center rounded-xl"
                  style={{
                    background: "var(--primary-lighter)",
                    color: "var(--primary)",
                  }}
                >
                  <Icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <h3 className="relative mt-5 text-lg font-semibold tracking-tight">
                  {title}
                </h3>
                <p className="relative mt-2 text-sm leading-relaxed text-text-secondary">
                  {body}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pb-24">
          <motion.div
            variants={stagger}
            {...motionProps}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.span
              variants={fadeUp}
              className="text-xs font-semibold uppercase tracking-[0.2em]"
              style={{ color: "var(--primary)" }}
            >
              How it works
            </motion.span>
            <motion.h2
              variants={fadeUp}
              className="mt-3 text-4xl font-semibold tracking-tight md:text-5xl"
            >
              Live in a day. Compounding from week one.
            </motion.h2>
          </motion.div>

          <motion.ol
            variants={stagger}
            {...motionProps}
            className="mt-14 grid gap-6 md:grid-cols-3"
          >
            {steps.map((step, i) => (
              <motion.li
                key={step.title}
                variants={fadeUp}
                className="relative rounded-2xl border border-border bg-surface p-7 shadow-card"
              >
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
                    }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-lg font-semibold tracking-tight">
                    {step.title}
                  </h3>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-text-secondary">
                  {step.body}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </section>

      {/* Stats */}
      <section id="results" className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pb-24">
          <motion.div
            variants={stagger}
            {...motionProps}
            className="overflow-hidden rounded-3xl border border-border p-10 shadow-card"
            style={{
              background:
                "linear-gradient(135deg, rgba(13,79,108,0.04) 0%, rgba(62,200,160,0.07) 100%)",
            }}
          >
            <motion.div variants={fadeUp} className="max-w-2xl">
              <span
                className="text-xs font-semibold uppercase tracking-[0.2em]"
                style={{ color: "var(--primary)" }}
              >
                Real outcomes
              </span>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
                The numbers clinic owners actually care about.
              </h2>
            </motion.div>

            <motion.div
              variants={stagger}
              className="mt-10 grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-4"
            >
              {stats.map((s) => (
                <motion.div key={s.label} variants={fadeUp}>
                  <div
                    className="text-4xl font-semibold tracking-tight md:text-5xl"
                    style={{ color: "var(--primary)" }}
                  >
                    {s.value}
                  </div>
                  <div className="mt-2 text-sm text-text-secondary">
                    {s.label}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="relative z-10">
        <div className="mx-auto max-w-4xl px-6 pb-24">
          <motion.figure
            variants={fadeUp}
            {...motionProps}
            className="relative rounded-3xl border border-border bg-surface p-10 shadow-card md:p-14"
          >
            <Quote
              className="absolute -top-5 left-10 h-10 w-10 rounded-full bg-surface p-2 text-white shadow-card"
              style={{ background: "var(--primary)" }}
            />
            <blockquote className="text-balance text-2xl font-medium leading-relaxed tracking-tight md:text-3xl">
              &ldquo;Clinicovia replaced our front-desk chaos with one calm
              dashboard. Bookings are up, no-shows are down, and our team
              finally has time to actually treat patients.&rdquo;
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <div
                className="flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold text-white"
                style={{
                  background:
                    "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
                }}
              >
                LR
              </div>
              <div>
                <div className="font-semibold">Dr. Lina Rahmani</div>
                <div className="text-sm text-text-secondary">
                  Founder, Aurora Medical Group
                </div>
              </div>
            </figcaption>
          </motion.figure>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative z-10">
        <div className="mx-auto max-w-6xl px-6 pb-24">
          <motion.div
            variants={stagger}
            {...motionProps}
            className="relative overflow-hidden rounded-3xl p-10 text-center md:p-16"
            style={{
              background:
                "linear-gradient(135deg, var(--primary) 0%, #0A3F58 60%, #16846A 120%)",
            }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "radial-gradient(40% 50% at 20% 0%, rgba(255,255,255,0.25), transparent), radial-gradient(40% 50% at 80% 100%, rgba(62,200,160,0.4), transparent)",
              }}
            />
            <motion.h2
              variants={fadeUp}
              className="relative text-balance text-4xl font-semibold tracking-tight text-white md:text-5xl"
            >
              Ready to grow without hiring?
            </motion.h2>
            <motion.p
              variants={fadeUp}
              className="relative mx-auto mt-4 max-w-2xl text-pretty text-lg text-white/80"
            >
              Set up Clinicovia in under an hour. Your AI agent answers the
              very next message that hits your WhatsApp.
            </motion.p>
            <motion.div
              variants={fadeUp}
              className="relative mt-8 flex flex-wrap items-center justify-center gap-3"
            >
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-[color:var(--primary)] shadow-card-hover transition hover:translate-y-[-1px]"
              >
                Create your account
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Sign in
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border bg-surface/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-secondary md:flex-row">
          <div className="flex items-center gap-2">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-lg text-white"
              style={{
                background:
                  "linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)",
              }}
            >
              <Stethoscope className="h-4 w-4" strokeWidth={2.2} />
            </span>
            <span className="font-semibold text-text-primary">Clinicovia</span>
            <span className="text-text-muted">© {new Date().getFullYear()}</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="#features" className="hover:text-text-primary">
              Features
            </a>
            <a href="#how" className="hover:text-text-primary">
              How it works
            </a>
            <Link href="/login" className="hover:text-text-primary">
              Sign in
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroDashboard({ reduced }: { reduced: boolean }) {
  const float = reduced
    ? {}
    : {
        animate: { y: [0, -8, 0] },
        transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const },
      };

  const floatSlow = reduced
    ? {}
    : {
        animate: { y: [0, 6, 0] },
        transition: { duration: 7, repeat: Infinity, ease: "easeInOut" as const },
      };

  return (
    <div className="relative">
      {/* Glow */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[32px] opacity-60 blur-2xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(13,79,108,0.18), rgba(62,200,160,0.18))",
        }}
      />

      {/* Main card */}
      <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-5 shadow-modal">
        {/* Window header */}
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
          <span className="ml-3 text-xs text-text-muted">
            clinicovia.app — Today
          </span>
        </div>

        {/* Top row */}
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Booked today", value: "38" },
            { label: "Response time", value: "22s" },
            { label: "Pipeline", value: "$48.2k" },
          ].map((c, i) => (
            <motion.div
              key={c.label}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease, delay: 0.3 + i * 0.08 }}
              className="rounded-xl border border-border bg-background p-3"
            >
              <div className="text-xs text-text-muted">{c.label}</div>
              <div className="mt-1 text-xl font-semibold tracking-tight">
                {c.value}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Chart */}
        <div className="mt-4 rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Bookings — last 14 days</div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--primary-lighter)] px-2 py-0.5 text-xs font-semibold text-[color:var(--primary)]">
              <Sparkles className="h-3 w-3" /> +38%
            </div>
          </div>
          <svg
            viewBox="0 0 320 110"
            className="mt-3 h-28 w-full"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="heroGrad" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#3EC8A0" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#3EC8A0" stopOpacity="0" />
              </linearGradient>
            </defs>
            <motion.path
              d="M0,80 C20,72 35,68 55,60 C80,50 95,72 120,62 C145,52 165,30 195,38 C225,46 245,22 275,18 C295,16 310,22 320,18 L320,110 L0,110 Z"
              fill="url(#heroGrad)"
              initial={reduced ? undefined : { opacity: 0 }}
              animate={reduced ? undefined : { opacity: 1 }}
              transition={{ duration: 1.2, ease, delay: 0.6 }}
            />
            <motion.path
              d="M0,80 C20,72 35,68 55,60 C80,50 95,72 120,62 C145,52 165,30 195,38 C225,46 245,22 275,18 C295,16 310,22 320,18"
              fill="none"
              stroke="#0D4F6C"
              strokeWidth="2.5"
              strokeLinecap="round"
              initial={reduced ? undefined : { pathLength: 0 }}
              animate={reduced ? undefined : { pathLength: 1 }}
              transition={{ duration: 1.4, ease, delay: 0.4 }}
            />
          </svg>
        </div>

        {/* Bottom row: AI message + appt */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <span
                className="flex h-5 w-5 items-center justify-center rounded-md text-white"
                style={{ background: "var(--whatsapp)" }}
              >
                <MessageCircle className="h-3 w-3" />
              </span>
              AI Agent · WhatsApp
            </div>
            <div className="mt-2 rounded-lg bg-[color:var(--primary-lighter)] px-3 py-2 text-xs leading-relaxed text-[color:var(--primary)]">
              Hi Sara — I have a 3pm slot tomorrow with Dr. Younes. Want me to
              book it?
            </div>
          </div>
          <div className="rounded-xl border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-xs text-text-muted">
              <CalendarCheck className="h-3.5 w-3.5" />
              Next appointment
            </div>
            <div className="mt-2 text-sm font-semibold">Sara K.</div>
            <div className="text-xs text-text-secondary">
              Tomorrow · 3:00 PM · Dr. Younes
            </div>
          </div>
        </div>
      </div>

      {/* Floating badges */}
      <motion.div
        {...float}
        className="absolute -left-6 top-16 hidden items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-xs shadow-card md:flex"
      >
        <ShieldCheck
          className="h-4 w-4"
          style={{ color: "var(--primary-light)" }}
        />
        <div>
          <div className="font-semibold">HIPAA-ready</div>
          <div className="text-[11px] text-text-muted">End-to-end encrypted</div>
        </div>
      </motion.div>

      <motion.div
        {...floatSlow}
        className="absolute -right-4 -bottom-4 hidden items-center gap-2 rounded-2xl border border-border bg-surface px-3 py-2 text-xs shadow-card md:flex"
      >
        <Users className="h-4 w-4" style={{ color: "var(--primary)" }} />
        <div>
          <div className="font-semibold">+128 patients</div>
          <div className="text-[11px] text-text-muted">this week</div>
        </div>
      </motion.div>
    </div>
  );
}
