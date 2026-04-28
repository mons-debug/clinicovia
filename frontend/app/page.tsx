"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import "./landing.css";

const ease = [0.22, 1, 0.36, 1] as const;

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease } },
};

const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

/* ---------- Inline icon set (matches the design) ---------- */
type IconName =
  | "arrow-up-right"
  | "arrow-right"
  | "plus"
  | "check"
  | "whatsapp"
  | "calendar"
  | "bell";

function Icon({
  name,
  size = 18,
  color = "currentColor",
  strokeWidth = 1.6,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const props = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: color,
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "arrow-up-right":
      return (
        <svg {...props}>
          <path d="M7 17L17 7M9 7h8v8" />
        </svg>
      );
    case "arrow-right":
      return (
        <svg {...props}>
          <path d="M5 12h14M13 6l6 6-6 6" />
        </svg>
      );
    case "plus":
      return (
        <svg {...props}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "check":
      return (
        <svg {...props}>
          <path d="M5 12l4 4 10-10" />
        </svg>
      );
    case "whatsapp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
          <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9-.3-.1-.5-.1-.7.1-.2.3-.7.9-.9 1.1-.2.2-.3.2-.6.1-.3-.1-1.2-.4-2.3-1.4-.8-.7-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.7-1.7c-.2-.4-.4-.4-.5-.4h-.5c-.2 0-.4.1-.6.3-.2.2-.8.8-.8 2 0 1.2.9 2.3 1 2.5.1.2 1.7 2.7 4.1 3.7.6.3 1 .4 1.4.5.6.2 1.1.2 1.5.1.5-.1 1.7-.7 1.9-1.3.2-.6.2-1.2.1-1.3 0-.1-.2-.2-.5-.3zM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.1-1.3c1.4.8 3.1 1.3 4.9 1.3 5.5 0 10-4.5 10-10S17.5 2 12 2z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...props}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      );
    case "bell":
      return (
        <svg {...props}>
          <path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" />
          <path d="M10 21a2 2 0 004 0" />
        </svg>
      );
    default:
      return null;
  }
}

/* ---------- Page ---------- */
export default function Home() {
  const reduced = useReducedMotion();

  const inView = reduced
    ? {}
    : {
        initial: "hidden" as const,
        whileInView: "show" as const,
        viewport: { once: true, margin: "-80px" },
      };

  return (
    <div className="clinicovia-landing">
      <Nav />
      <Hero reduced={!!reduced} inView={inView} />
      <Features reduced={!!reduced} inView={inView} />
      <How reduced={!!reduced} inView={inView} />
      <Showcase reduced={!!reduced} inView={inView} />
      <Testimonial reduced={!!reduced} inView={inView} />
      <Pricing reduced={!!reduced} inView={inView} />
      <FAQ reduced={!!reduced} inView={inView} />
      <CTABanner reduced={!!reduced} inView={inView} />
      <Footer />
    </div>
  );
}

/* ---------- Nav ---------- */
function Nav() {
  return (
    <motion.nav
      className="nav"
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
    >
      <div className="wrap nav-inner">
        <Link className="brand" href="/" aria-label="Clinicovia home">
          <img className="brand-logo" src="/logo.webp" alt="Clinicovia" />
        </Link>
        <div className="nav-links">
          <a href="#features">Platform</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
          <a href="#contact">Contact</a>
        </div>
        <div className="nav-cta">
          <Link className="btn btn-ghost" href="/login">
            Sign in
          </Link>
          <Link className="btn btn-primary" href="/register">
            Book a demo
          </Link>
        </div>
      </div>
    </motion.nav>
  );
}

/* ---------- Hero ---------- */
type MotionDeps = {
  reduced: boolean;
  inView: Record<string, unknown>;
};

function Hero({ reduced, inView }: MotionDeps) {
  const headline =
    "The all-in-one clinic OS your patients chat with on WhatsApp.";

  return (
    <section className="hero" id="top">
      <div className="wrap">
        <div className="hero-grid">
          <motion.div variants={stagger} {...inView}>
            <motion.span variants={fadeUp} className="eyebrow">
              <span className="dot" />
              WhatsApp-first clinic platform
            </motion.span>

            <motion.h1
              variants={fadeUp}
              className="serif h-display"
              style={{ marginTop: 22 }}
            >
              {headline.split(" ").map((w, i) => {
                const lower = w.toLowerCase();
                if (lower.includes("whatsapp"))
                  return (
                    <span key={i}>
                      <span className="accent-teal">{w}</span>{" "}
                    </span>
                  );
                if (lower.includes("chat"))
                  return (
                    <span key={i}>
                      <span className="accent">{w}</span>{" "}
                    </span>
                  );
                return <span key={i}>{w} </span>;
              })}
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="lead"
              style={{ marginTop: 22 }}
            >
              Clinicovia turns WhatsApp into a booking, reminder, and
              patient-records hub — so your front desk stops chasing no-shows
              and starts running the day.
            </motion.p>

            <motion.div
              variants={fadeUp}
              style={{ display: "flex", gap: 12, marginTop: 32, flexWrap: "wrap" }}
            >
              <Link className="btn btn-primary" href="/register">
                Start free trial
                <span className="btn-arrow">
                  <Icon name="arrow-right" size={14} color="white" />
                </span>
              </Link>
              <a className="btn btn-ghost" href="#contact">
                <Icon name="whatsapp" size={16} color="#0e7490" />
                See it on WhatsApp
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="hero-meta">
              <div className="avatars">
                {["#d8c9aa", "#cfdce8", "#e2dcf3", "#d6f0e1"].map((bg, i) => (
                  <span key={i} style={{ background: bg }} />
                ))}
              </div>
              <span>
                <strong style={{ color: "inherit" }}>320+</strong> clinics
                across MENA already onboard
              </span>
            </motion.div>
          </motion.div>

          {/* Visual */}
          <motion.div
            className="hero-visual"
            initial={reduced ? false : { opacity: 0, y: 32 }}
            animate={reduced ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease, delay: 0.2 }}
          >
            <div className="hero-portrait">
              <div className="placeholder-photo">
                <div className="silhouette" />
              </div>
            </div>

            <motion.div
              className="float-card float-1"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={
                reduced
                  ? undefined
                  : { opacity: 1, y: [0, -6, 0] }
              }
              transition={{
                opacity: { duration: 0.5, ease, delay: 0.6 },
                y: { duration: 5, repeat: Infinity, ease: "easeInOut", delay: 0.6 },
              }}
            >
              <span className="ic">
                <Icon name="calendar" size={14} />
              </span>
              3 new bookings today
            </motion.div>

            <motion.div
              className="float-card float-2"
              initial={reduced ? false : { opacity: 0, y: 12 }}
              animate={reduced ? undefined : { opacity: 1, y: [0, 6, 0] }}
              transition={{
                opacity: { duration: 0.5, ease, delay: 0.8 },
                y: { duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.8 },
              }}
            >
              <span className="ic" style={{ background: "#fde6d6", color: "#c2480a" }}>
                <Icon name="bell" size={14} />
              </span>
              Reminder sent · 12:40
            </motion.div>

            <motion.div
              className="chat-card"
              initial={reduced ? false : { opacity: 0, y: 24 }}
              animate={reduced ? undefined : { opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease, delay: 0.4 }}
            >
              <div className="chat-head">
                <div className="chat-avatar">C</div>
                <div>
                  <div className="chat-name">Clinicovia · Dr. Hana Clinic</div>
                  <div className="chat-status">Online · replies in seconds</div>
                </div>
              </div>
              <div className="chat-body">
                <div className="bubble in">
                  Hi! I&apos;d like to book a check-up this Thursday
                </div>
                <div className="bubble out">
                  Sure — Dr. Hana has 3:40 or 5:10 PM open. Which works?
                </div>
                <div className="bubble in">5:10 PM please.</div>
                <div className="typing">
                  <i></i>
                  <i></i>
                  <i></i>
                </div>
                <button className="chat-cta" type="button">
                  <Icon name="check" size={12} color="white" />
                  Confirm appointment
                </button>
              </div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div className="logos" {...inView} variants={fadeUp}>
          <div className="logos-row">
            <span className="logos-label">
              Integrates with the tools your clinic already uses
            </span>
            <div className="logos-list">
              {["Stripe", "Twilio", "Google Cal", "Outlook", "HL7 FHIR", "Mailchimp"].map(
                (n) => (
                  <span className="logo" key={n}>
                    <span className="logo-mark" />
                    {n}
                  </span>
                ),
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Features ---------- */
function Features({ inView }: MotionDeps) {
  const items = [
    {
      num: "01",
      chip: "WhatsApp",
      title: "Bookings on WhatsApp, with no app to install",
      desc: "Patients chat to book, reschedule, or cancel. Confirmations land in their thread, not their inbox.",
    },
    {
      num: "02",
      chip: "Patient CRM",
      title: "A timeline-first record for every patient",
      desc: "Visits, prescriptions, lab files and chat history sit in one searchable profile your team trusts.",
    },
    {
      num: "03",
      chip: "Automation",
      title: "Reminders, follow-ups and recalls on rails",
      desc: "Drop no-shows by 60% with templated nudges, post-visit check-ins and yearly recall flows.",
    },
  ];

  return (
    <section id="features">
      <div className="wrap">
        <motion.div className="features-band" variants={stagger} {...inView}>
          <div className="section-head" style={{ marginBottom: 0 }}>
            <motion.h2 variants={fadeUp} className="serif h-section">
              Built for the way modern clinics actually work.
            </motion.h2>
            <motion.p variants={fadeUp} className="lead">
              A WhatsApp-native front desk, a clinical CRM, and an automation
              engine — under one roof, without the spreadsheets.
            </motion.p>
          </div>
          <div className="features-grid">
            {items.map((it) => (
              <motion.div className="feature-tile" key={it.num} variants={fadeUp}>
                <span className="chip">{it.chip}</span>
                <span className="arrow">
                  <Icon name="arrow-up-right" size={14} />
                </span>
                <h3>{it.title}</h3>
                <p>{it.desc}</p>
                <span
                  className="num"
                  style={{
                    fontFamily: "Instrument Serif, serif",
                    fontSize: 14,
                    color: "var(--teal-soft)",
                    opacity: 0.7,
                  }}
                >
                  — {it.num}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- How it works ---------- */
function How({ inView }: MotionDeps) {
  const steps = [
    {
      n: "01",
      t: "Connect your WhatsApp",
      d: "Plug in your clinic number in 5 minutes. We handle the Business API, templates, and verification.",
    },
    {
      n: "02",
      t: "Import patients & calendars",
      d: "Migrate from Excel, Google, or your existing PMS. Mapping is automatic; nothing slips.",
    },
    {
      n: "03",
      t: "Turn on automations",
      d: "Pick from 14 ready-to-go flows for reminders, recalls, intake forms and reviews.",
    },
    {
      n: "04",
      t: "Go live with your team",
      d: "Front desk, doctors and managers each get a tailored view. Onboarding done in a week.",
    },
  ];

  return (
    <section id="how" style={{ background: "var(--paper)" }}>
      <div className="wrap">
        <motion.div className="section-head" variants={stagger} {...inView}>
          <motion.div variants={fadeUp}>
            <span className="eyebrow">
              <span className="dot" />
              How it works
            </span>
            <h2 className="serif h-section" style={{ marginTop: 18 }}>
              From signed-up to scheduled in a week — not a quarter.
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="right">
            <p style={{ margin: 0 }}>
              Most clinics go live within 5 working days. We handle WhatsApp
              Business approval, data import, and team training, so the loudest
              change your patients notice is a faster reply.
            </p>
          </motion.div>
        </motion.div>

        <motion.div className="steps" variants={stagger} {...inView}>
          {steps.map((s) => (
            <motion.div className="step" key={s.n} variants={fadeUp}>
              <span className="step-num">{s.n}</span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Showcase ---------- */
function Showcase({ inView }: MotionDeps) {
  return (
    <section>
      <div className="wrap">
        <motion.div className="section-head" variants={stagger} {...inView}>
          <motion.div variants={fadeUp}>
            <span className="eyebrow">
              <span className="dot" />
              Outcomes, not features
            </span>
            <h2 className="serif h-section" style={{ marginTop: 18 }}>
              Fewer no-shows. Happier patients. A calmer front desk.
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="right">
            <p style={{ margin: 0 }}>
              Numbers across 320+ clinics on Clinicovia after 90 days of use.
            </p>
          </motion.div>
        </motion.div>

        <motion.div className="showcase" variants={stagger} {...inView}>
          <motion.div className="showcase-photo" variants={fadeUp}>
            <span className="ph-label">photo placeholder · receptionist on WhatsApp</span>
            <div className="silhouette" />
          </motion.div>
          <motion.div className="showcase-info" variants={fadeUp}>
            <div className="kpi-row">
              {[
                { v: "−62%", l: "No-show rate, on average" },
                { v: "3.4×", l: "More 5-star reviews / month" },
                { v: "9 min", l: "Saved per booking" },
                { v: "98%", l: "Reminder open rate on WA" },
              ].map((k) => (
                <div className="kpi" key={k.l}>
                  <div className="v">{k.v}</div>
                  <div className="l">{k.l}</div>
                </div>
              ))}
            </div>
            <div className="dash-card">
              <div className="dash-head">
                <span>Bookings · this week</span>
                <span style={{ color: "var(--teal)", fontWeight: 600 }}>+24%</span>
              </div>
              <div className="dash-bar">
                {[40, 55, 48, 72, 60, 84, 68].map((h, i) => (
                  <motion.i
                    key={i}
                    initial={{ height: 0 }}
                    whileInView={{ height: `${h}%` }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.7, ease, delay: i * 0.06 }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Testimonial ---------- */
function Testimonial({ inView }: MotionDeps) {
  return (
    <section>
      <div className="wrap">
        <motion.div className="testimonial" variants={stagger} {...inView}>
          <motion.div variants={fadeUp}>
            <span className="eyebrow">
              <span className="dot" />
              From the field
            </span>
            <blockquote style={{ marginTop: 22 }}>
              &ldquo;We replaced four tools with Clinicovia. The front desk used
              to call 80 patients a day to confirm — now WhatsApp does it, and
              they actually have time for the people in front of them.&rdquo;
            </blockquote>
            <cite>
              <strong>Dr. Layla Mansour</strong>
              Owner · Mansour Family Clinic, Amman · 6 doctors, 4,200 active
              patients
            </cite>
          </motion.div>
          <motion.div className="testimonial-photo" variants={fadeUp}>
            <span className="ph-label">photo placeholder · clinic owner</span>
            <div className="silhouette" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Pricing ---------- */
function Pricing({ inView }: MotionDeps) {
  const plans = [
    {
      tag: "Solo",
      price: "$49",
      desc: "1 doctor · 1 clinic line",
      feat: [
        "WhatsApp bookings & reminders",
        "Patient CRM up to 1,000",
        "Email & chat support",
        "Basic reporting",
      ],
    },
    {
      tag: "Practice",
      price: "$129",
      desc: "Up to 8 doctors",
      feat: [
        "Everything in Solo",
        "Up to 10,000 patients",
        "Reviews & recalls",
        "Custom intake forms",
        "API access",
      ],
      featured: true,
    },
    {
      tag: "Network",
      price: "Custom",
      desc: "Multi-branch operators",
      feat: [
        "Unlimited patients",
        "SSO + role-based access",
        "HL7 / FHIR integrations",
        "Dedicated success manager",
        "Onboarding & training",
      ],
    },
  ];

  return (
    <section id="pricing" style={{ background: "var(--paper)" }}>
      <div className="wrap">
        <motion.div className="section-head" variants={stagger} {...inView}>
          <motion.div variants={fadeUp}>
            <span className="eyebrow">
              <span className="dot" />
              Pricing
            </span>
            <h2 className="serif h-section" style={{ marginTop: 18 }}>
              Simple plans that scale with your clinic.
            </h2>
          </motion.div>
          <motion.div variants={fadeUp} className="right">
            <p style={{ margin: 0 }}>
              14 days free, no credit card. Switch plans any time. Cancel in one
              click — we&apos;ll even export your data for you.
            </p>
          </motion.div>
        </motion.div>

        <motion.div className="pricing-grid" variants={stagger} {...inView}>
          {plans.map((p) => (
            <motion.div
              className={"plan" + (p.featured ? " feat" : "")}
              key={p.tag}
              variants={fadeUp}
              whileHover={{ y: -4, transition: { duration: 0.2, ease } }}
            >
              <h3>{p.tag}</h3>
              <div>
                <div className="price">
                  {p.price}
                  {p.price !== "Custom" && <small>/ month</small>}
                </div>
                <div
                  className="muted"
                  style={{
                    fontSize: 13,
                    color: p.featured ? "rgba(255,255,255,0.7)" : "var(--muted)",
                    marginTop: 6,
                  }}
                >
                  {p.desc}
                </div>
              </div>
              <ul>
                {p.feat.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link
                href={p.price === "Custom" ? "#contact" : "/register"}
                className={"btn " + (p.featured ? "btn-teal" : "btn-ghost")}
                style={{ justifyContent: "center", marginTop: "auto" }}
              >
                {p.price === "Custom" ? "Talk to sales" : "Start free trial"}
                <Icon name="arrow-right" size={14} />
              </Link>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- FAQ ---------- */
function FAQ({ inView }: MotionDeps) {
  const items = [
    {
      q: "Do my patients need to install anything?",
      a: "No. Clinicovia runs on the WhatsApp number your patients already use. No app, no portal, no password — they just chat.",
    },
    {
      q: "How long does setup take?",
      a: "Most clinics go live in 3–5 working days. We handle WhatsApp Business API approval, data migration, and team onboarding for you.",
    },
    {
      q: "Is patient data secure?",
      a: "Yes. We are HIPAA-aligned and GDPR compliant, with end-to-end encryption, role-based access, and full audit logs. Data is hosted in your region.",
    },
    {
      q: "Does it integrate with my existing PMS?",
      a: "We connect with most major practice-management systems via API or HL7/FHIR. Tell us yours and we will confirm in 24 hours.",
    },
    {
      q: "Can I keep using my current WhatsApp number?",
      a: "Yes — your existing business number stays the same. Patients see no disruption; only your team sees the new tools.",
    },
  ];
  const [open, setOpen] = useState(0);

  return (
    <section id="faq">
      <div className="wrap">
        <motion.div className="faq-grid" variants={stagger} {...inView}>
          <motion.div variants={fadeUp}>
            <span className="eyebrow">
              <span className="dot" />
              FAQ
            </span>
            <h2 className="serif h-section" style={{ marginTop: 18 }}>
              Questions, answered.
            </h2>
            <p className="lead" style={{ marginTop: 22 }}>
              Can&apos;t find what you&apos;re looking for? Our team replies on
              WhatsApp in under 5 minutes.
            </p>
          </motion.div>
          <motion.div variants={fadeUp}>
            {items.map((it, i) => {
              const isOpen = open === i;
              return (
                <div key={i} className={"faq-item" + (isOpen ? " open" : "")}>
                  <div
                    className="faq-q"
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{it.q}</span>
                    <span className="faq-toggle">
                      <Icon name="plus" size={14} />
                    </span>
                  </div>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        key="content"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="faq-a">{it.a}</div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- CTA banner ---------- */
function CTABanner({ inView }: MotionDeps) {
  return (
    <section id="contact">
      <div className="wrap">
        <motion.div className="cta-banner" variants={stagger} {...inView}>
          <motion.h2 variants={fadeUp} className="serif h-section">
            Run your clinic on WhatsApp. Start free for 14 days.
          </motion.h2>
          <motion.p variants={fadeUp}>
            No credit card. White-glove migration included. Cancel anytime — and
            we&apos;ll export every byte of your data for you.
          </motion.p>
          <motion.div variants={fadeUp} className="cta-row">
            <Link className="btn btn-light" href="/register">
              Start free trial
              <Icon name="arrow-right" size={14} />
            </Link>
            <a
              className="btn"
              href="#"
              style={{
                background: "rgba(255,255,255,0.1)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
              }}
            >
              <Icon name="whatsapp" size={16} color="white" /> Chat with us
            </a>
          </motion.div>
          <motion.div variants={fadeUp} className="cta-meta">
            Trusted by 320+ clinics across 9 countries.
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ---------- Footer ---------- */
function Footer() {
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div className="foot-brand">
            <div className="brand" style={{ color: "#fff" }}>
              <img className="brand-logo brand-logo-light" src="/whitelogo.webp" alt="Clinicovia" />
            </div>
            <p>
              The WhatsApp-native clinic OS. Built for healthcare teams who want
              to spend less time on admin and more on patients.
            </p>
          </div>
          <div>
            <h4>Product</h4>
            <ul>
              <li>Platform</li>
              <li>Patient CRM</li>
              <li>WhatsApp suite</li>
              <li>Integrations</li>
              <li>Changelog</li>
            </ul>
          </div>
          <div>
            <h4>Company</h4>
            <ul>
              <li>About</li>
              <li>Customers</li>
              <li>Careers</li>
              <li>Press</li>
              <li>Contact</li>
            </ul>
          </div>
          <div>
            <h4>Resources</h4>
            <ul>
              <li>Help center</li>
              <li>Compliance</li>
              <li>API docs</li>
              <li>Status</li>
              <li>Privacy</li>
            </ul>
          </div>
        </div>
        <div className="foot-bottom">
          <span>© {new Date().getFullYear()} Clinicovia. All rights reserved.</span>
          <span>HIPAA-aligned · GDPR-ready · ISO 27001 (in process)</span>
        </div>
      </div>
    </footer>
  );
}
