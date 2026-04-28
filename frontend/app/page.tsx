import { Button } from "flowbite-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background">
      <div className="text-center">
        <h1 className="text-4xl font-bold" style={{ color: "var(--primary)" }}>
          Clinicovia
        </h1>
        <p className="mt-2 text-lg text-text-secondary">
          AI-Powered Clinic Growth Platform
        </p>
      </div>

      <div className="flex gap-4">
        <Link href="/login">
          <Button color="blue" size="lg">
            Sign In
          </Button>
        </Link>
        <Link href="/register">
          <Button color="gray" size="lg">
            Create Account
          </Button>
        </Link>
      </div>
    </div>
  );
}
