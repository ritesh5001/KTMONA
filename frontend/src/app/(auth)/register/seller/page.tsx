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
import { registerSeller } from "@/services/auth";
import { toast } from "sonner";
import { heroContainerVariants, heroItemVariants } from "@/lib/motion.config";

export default function SellerRegisterPage() {
  const theme = {
    page: "relative min-h-[calc(100vh-160px)] overflow-hidden bg-gradient-to-br from-mist via-paper to-background",
    texture: "pointer-events-none absolute inset-0 opacity-50",
    shell: "relative z-10 mx-auto flex min-h-[calc(100vh-160px)] max-w-6xl flex-col items-center justify-center gap-16 px-6 py-16 lg:flex-row lg:gap-24",
    eyebrow: "text-xs font-medium uppercase tracking-[0.3em] text-brand-strong mb-6",
    heading: "font-serif text-4xl font-light tracking-tight text-navy sm:text-5xl mb-6",
    headingAccent: "italic text-ink",
    body: "text-base leading-relaxed text-navy/80 mb-8",
    featureItem: "flex items-center gap-3 text-sm text-navy/80",
    card: "border-brand/25 bg-card/95 shadow-lg shadow-brand/10 hover:border-brand/40",
    cardTitle: "font-serif text-2xl font-normal text-navy",
    cardDescription: "text-navy/70",
    label: "text-navy/85",
    input:
      "border-border-soft/90 bg-paper/80 text-navy placeholder:text-navy/50 focus-visible:border-brand/60 focus-visible:ring-brand/30",
    toggle:
      "absolute right-4 top-1/2 -translate-y-1/2 text-navy/60 hover:text-navy transition-colors duration-300",
    button:
      "w-full border border-brand/30 bg-navy text-paper hover:bg-ink hover:shadow-lg hover:shadow-brand/20 hover:-translate-y-0.5",
    footer: "text-center text-sm text-navy/70",
    link: "text-navy hover:text-brand-strong transition-colors duration-300",
  } as const;

  const fadeInUp = (index: number) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: 0.45,
      delay: 0.2 + index * 0.05,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  });

  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [whatsappNumber, setWhatsappNumber] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirm, setShowConfirm] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!email || !phone || !whatsappNumber || !password) {
      toast.error("Please fill all required fields.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    if (!/^\d{10,15}$/.test(normalizedPhone)) {
      toast.error("Contact number must be 10 to 15 digits.");
      return;
    }

    setLoading(true);
    try {
      console.info("[auth-ui][register-seller] submit", {
        email: email.trim().toLowerCase(),
        phone: "[present]",
        whatsappNumber: "[present]",
      });
      await registerSeller({ email, phone: normalizedPhone, whatsappNumber, password });
      console.info("[auth-ui][register-seller] otp-sent", { phone: "[present]" });
      toast.success("OTP sent to your mobile number.");
      window.location.href = `/verify-otp?signup=1&phone=${encodeURIComponent(normalizedPhone)}`;
    } catch (error) {
      console.error("[auth-ui][register-seller] failed", error);
      toast.error(error instanceof Error ? error.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={theme.page}>
      <div className={theme.texture} aria-hidden>
        <div className="absolute inset-0 bg-linear-to-r from-transparent via-brand/10 to-transparent" />
        <div className="absolute inset-0 bg-linear-to-b from-transparent via-navy/10 to-transparent" />
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
            Seller Registration
          </motion.p>

          <motion.h1
            variants={heroItemVariants}
            className={theme.heading}
          >
            Grow your
            <br />
            <span className={theme.headingAccent}>business</span> with us.
          </motion.h1>

          <motion.p
            variants={heroItemVariants}
            className={theme.body}
          >
            Join trusted vendors across India. Manage your catalog, appointments,
            and payments with dedicated seller tools built for craftsmen.
          </motion.p>

          <motion.div
            variants={heroItemVariants}
            className="grid gap-3 sm:grid-cols-2"
          >
            {[
              "Dedicated seller dashboard",
              "Instant payout tracking",
              "Priority support team",
              "Verified vendor badge",
            ].map((item) => (
              <div
                key={item}
                className={theme.featureItem}
              >
                <span className="h-1 w-1 rounded-full bg-brand" />
                {item}
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-md"
        >
          <Card className={theme.card}>
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className={theme.cardTitle}>
                Register Your Business
              </CardTitle>
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: "5rem", opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.45, ease: "easeOut" }}
                className="h-px bg-brand"
              />
              <CardDescription className={theme.cardDescription}>
                Provide business details to create a seller account on KTMONA.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-5" onSubmit={handleSubmit}>
                <motion.div className="space-y-2" {...fadeInUp(0)}>
                  <Label htmlFor="email" required className={theme.label}>Business Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="owner@brand.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className={theme.input}
                  />
                </motion.div>
                <motion.div className="space-y-2" {...fadeInUp(1)}>
                  <Label htmlFor="phone" required className={theme.label}>Contact Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="9876543210"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value.replace(/\D/g, ""))}
                    className={theme.input}
                  />
                  <p className="text-xs text-navy/60">
                    Buyers use this number to reach you on WhatsApp for video appointments.
                  </p>
                </motion.div>
                <motion.div className="space-y-2" {...fadeInUp(2)}>
                  <Label htmlFor="whatsappNumber" required className={theme.label}>WhatsApp Number</Label>
                  <Input
                    id="whatsappNumber"
                    placeholder="9876543210"
                    value={whatsappNumber}
                    onChange={(event) => setWhatsappNumber(event.target.value.replace(/[^0-9]/g, ""))}
                    className={theme.input}
                  />
                </motion.div>
                <motion.div className="grid gap-4 sm:grid-cols-2" {...fadeInUp(3)}>
                  <div className="space-y-2">
                    <Label htmlFor="password" required className={theme.label}>Password</Label>
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
                    <Label htmlFor="confirm" required className={theme.label}>Confirm Password</Label>
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
                <motion.div {...fadeInUp(4)}>
                  <Button className={theme.button} size="lg" disabled={loading}>
                  {loading ? "Submitting..." : "Create Seller Account"}
                  </Button>
                </motion.div>
              </form>
              <p className={theme.footer}>
                Already a seller?{" "}
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
