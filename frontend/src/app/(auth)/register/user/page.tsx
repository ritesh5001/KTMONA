"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerUser } from "@/services/auth";
import { toast } from "sonner";
import { heroContainerVariants, heroItemVariants } from "@/lib/motion.config";

function normalizePhone(value: string): string {
  return value.replace(/\D/g, "");
}

/** One field for both: anything with "@" or letters is an email, digits are a mobile number. */
function detectIdentifier(value: string): "email" | "phone" | "unknown" {
  const trimmed = value.trim();
  if (!trimmed) return "unknown";
  if (trimmed.includes("@") || /[a-zA-Z]/.test(trimmed)) return "email";
  if (/^[+\d][\d\s\-()+]*$/.test(trimmed)) return "phone";
  return "unknown";
}

export default function UserRegisterPage() {
  const [fullName, setFullName] = React.useState("");
  const [identifier, setIdentifier] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!fullName || !identifier.trim() || !password) {
      toast.error("Please fill all required fields.");
      return;
    }

    const kind = detectIdentifier(identifier);
    const normalizedPhone = kind === "phone" ? normalizePhone(identifier) : "";
    const normalizedEmail = kind === "email" ? identifier.trim().toLowerCase() : "";
    if (kind === "phone" && !/^\d{10,15}$/.test(normalizedPhone)) {
      toast.error("Mobile number must be 10 to 15 digits.");
      return;
    }
    if (kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      toast.error("Enter a valid email address.");
      return;
    }
    if (kind === "unknown") {
      toast.error("Enter your email address or mobile number.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }

    if (!/[A-Z]/.test(password)) {
      toast.error("Password must contain at least 1 uppercase letter.");
      return;
    }

    if (!/[0-9]/.test(password)) {
      toast.error("Password must contain at least 1 number.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      console.info("[auth-ui][register-user] submit", { kind });
      const result = await registerUser({
        fullName: fullName.trim(),
        ...(kind === "phone" ? { phone: normalizedPhone } : { email: normalizedEmail }),
        password,
      });
      console.info("[auth-ui][register-user] otp-sent", { kind });
      toast.success(result.message);
      window.location.href =
        kind === "phone"
          ? `/verify-otp?signup=1&phone=${encodeURIComponent(normalizedPhone)}`
          : `/verify-otp?signup=1&email=${encodeURIComponent(normalizedEmail)}`;
    } catch (error) {
      console.error("[auth-ui][register-user] failed", error);
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-6xl flex-col items-center justify-center gap-16 px-6 py-16 lg:flex-row lg:gap-24">
        {/* Left Section - Editorial */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroContainerVariants}
          className="flex-1 max-w-md lg:max-w-lg"
        >
          <motion.p
            variants={heroItemVariants}
            className="text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-6"
          >
            User Registration
          </motion.p>

          <motion.h1
            variants={heroItemVariants}
            className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl mb-6"
          >
            Start your
            <br />
            <span className="italic">KTMONA</span> journey today.
          </motion.h1>

          <motion.p
            variants={heroItemVariants}
            className="text-base leading-relaxed text-muted-foreground mb-8"
          >
            Build a personalized profile, discover trusted matches, and keep
            everything safe with verified identity.
          </motion.p>

          <motion.ul
            variants={heroItemVariants}
            className="space-y-3 text-sm text-muted-foreground"
          >
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Profile verification within 24 hours
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Smart preferences and match insights
            </li>
            <li className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-brand" />
              Privacy controls for every step
            </li>
          </motion.ul>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-md"
        >
          <Card className="border-border-soft">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="font-serif text-2xl font-normal">
                Create your account
              </CardTitle>
              <CardDescription>
                Fill in the details below to register as a KTMONA user.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="name" required>Full name</Label>
                  <Input
                    id="name"
                    placeholder="Aarav Sharma"
                    autoComplete="off"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="identifier" required>Email or mobile number</Label>
                  <Input
                    id="identifier"
                    type="text"
                    placeholder="you@email.com or 9876543210"
                    value={identifier}
                    autoComplete="off"
                    onChange={(event) => setIdentifier(event.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    {detectIdentifier(identifier) === "email"
                      ? "We'll email a verification code to this address."
                      : detectIdentifier(identifier) === "phone"
                        ? "We'll send a verification code to this number by SMS."
                        : "Use whichever you prefer — we'll send a verification code to it."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password" required>Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-300"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use at least 8 characters, 1 uppercase letter, and 1 number.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm" required>Confirm password</Label>
                    <div className="relative">
                      <Input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((value) => !value)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-300"
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </div>
                <Button className="w-full" size="lg" disabled={loading}>
                  {loading ? "Creating account..." : "Create account"}
                </Button>
              </form>
              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link
                  className="text-foreground hover:text-brand-strong transition-colors duration-300"
                  href="/login"
                >
                  Sign in
                </Link>
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
