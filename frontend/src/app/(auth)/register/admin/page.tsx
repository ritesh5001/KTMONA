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
import { toast } from "sonner";
import { registerAdmin } from "@/services/auth";
import { heroContainerVariants, heroItemVariants } from "@/lib/motion.config";

export default function AdminRegisterPage() {
  const theme = {
    page: "relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-b from-ink via-ink to-navy/80",
    texture: "pointer-events-none absolute inset-0 opacity-30",
    shell: "relative z-10 mx-auto flex min-h-[calc(100vh-160px)] max-w-6xl flex-col items-center justify-center gap-16 px-6 py-16 lg:flex-row lg:gap-24",
    eyebrow: "text-xs font-medium uppercase tracking-[0.3em] text-brand-strong/85 mb-6",
    heading:
      "text-4xl font-semibold uppercase tracking-[0.08em] text-paper sm:text-5xl mb-6",
    headingAccent: "text-brand-strong/90",
    body: "text-base leading-relaxed text-paper/75 mb-8",
    statPanel: "border border-brand/30 bg-ink/60 backdrop-blur-sm p-6 space-y-4",
    statLabel: "text-paper/70",
    statBadge:
      "px-3 py-1 text-[10px] font-medium uppercase tracking-wider border border-brand/40 text-brand bg-ink/80",
    card:
      "rounded-sm border-brand/40 bg-ink/70 backdrop-blur-sm shadow-lg shadow-black/25 hover:translate-y-0 hover:shadow-lg",
    cardTitle: "text-2xl font-semibold uppercase tracking-[0.08em] text-paper",
    cardDescription: "text-paper/70",
    label: "text-paper/85",
    input:
      "rounded-sm border-border bg-ink/50 text-paper placeholder:text-paper/45 focus-visible:border-brand/70 focus-visible:ring-brand/20",
    toggle:
      "absolute right-4 top-1/2 -translate-y-1/2 text-paper/60 hover:text-brand-strong transition-colors duration-300",
    button:
      "w-full rounded-sm border border-brand/60 bg-ink text-paper hover:bg-black/70 hover:-translate-y-0.5",
    footer: "text-center text-sm text-paper/70",
    link: "text-brand-strong/90 hover:text-brand-strong transition-colors duration-300",
  } as const;

  const fadeInField = (index: number) => ({
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.5,
      delay: 0.18 + index * 0.05,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  });

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [department, setDepartment] = React.useState("");
  const [designation, setDesignation] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!firstName || !lastName || !email || !password) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await registerAdmin({
        firstName,
        lastName,
        email,
        password,
        phone: phone || undefined,
        department: department || undefined,
        designation: designation || undefined,
      });
      toast.success("Admin account created. Please sign in.");
      window.location.href = "/login";
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={theme.page}>
      <div className={theme.texture} aria-hidden>
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-brand/10 to-transparent" />
      </div>

      <div className={theme.shell}>
        {/* Left Section - Editorial */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={heroContainerVariants}
          className="flex-1 max-w-md lg:max-w-lg"
        >
          <motion.p
            variants={heroItemVariants}
            className={theme.eyebrow}
          >
            Admin Registration
          </motion.p>

          <motion.h1
            variants={heroItemVariants}
            className={theme.heading}
          >
            Platform
            <br />
            <span className={theme.headingAccent}>Governance</span>
          </motion.h1>

          <motion.p
            variants={heroItemVariants}
            className={theme.body}
          >
            Set up administrative access with verification steps and enforce
            governance policies across the KTMONA platform.
          </motion.p>

          <motion.div
            variants={heroItemVariants}
            className={theme.statPanel}
          >
            {[
              { label: "Access level", value: "Super admin" },
              { label: "Security audit", value: "Mandatory" },
              { label: "Compliance review", value: "Required" },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className={theme.statLabel}>{item.label}</span>
                <span className={theme.statBadge}>
                  {item.value}
                </span>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-md"
        >
          <Card className={theme.card}>
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className={theme.cardTitle}>
                Provision Admin Account
              </CardTitle>
              <CardDescription className={theme.cardDescription}>
                Restricted access. Use official verification details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <motion.div className="grid gap-4 sm:grid-cols-2" {...fadeInField(0)}>
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className={theme.label}>First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="Aditi"
                      value={firstName}
                      onChange={(event) => setFirstName(event.target.value)}
                      className={theme.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className={theme.label}>Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Mehta"
                      value={lastName}
                      onChange={(event) => setLastName(event.target.value)}
                      className={theme.input}
                    />
                  </div>
                </motion.div>
                <motion.div className="space-y-2" {...fadeInField(1)}>
                  <Label htmlFor="email" className={theme.label}>Work Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="admin@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={theme.input}
                  />
                </motion.div>
                <motion.div className="space-y-2" {...fadeInField(2)}>
                  <Label htmlFor="phone" className={theme.label}>Contact Number (Optional)</Label>
                  <Input
                    id="phone"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className={theme.input}
                  />
                </motion.div>
                <motion.div className="grid gap-4 sm:grid-cols-2" {...fadeInField(3)}>
                  <div className="space-y-2">
                    <Label htmlFor="department" className={theme.label}>Department (Optional)</Label>
                    <Input
                      id="department"
                      placeholder="Operations"
                      value={department}
                      onChange={(event) => setDepartment(event.target.value)}
                      className={theme.input}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="designation" className={theme.label}>Designation (Optional)</Label>
                    <Input
                      id="designation"
                      placeholder="Compliance lead"
                      value={designation}
                      onChange={(event) => setDesignation(event.target.value)}
                      className={theme.input}
                    />
                  </div>
                </motion.div>
                <motion.div className="grid gap-4 sm:grid-cols-2" {...fadeInField(4)}>
                  <div className="space-y-2">
                    <Label htmlFor="password" className={theme.label}>Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Min 8 chars"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        className={theme.input}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((value) => !value)}
                        className={theme.toggle}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirm" className={theme.label}>Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        placeholder="Re-enter"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        className={theme.input}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((value) => !value)}
                        className={theme.toggle}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>
                </motion.div>
                <motion.div {...fadeInField(5)}>
                  <Button className={theme.button} size="lg" type="submit" disabled={loading}>
                    {loading ? "Creating admin..." : "Request Admin Access"}
                  </Button>
                </motion.div>
              </form>
              <p className={theme.footer}>
                Already authorized?{" "}
                <Link
                  className={theme.link}
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
