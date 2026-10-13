"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
import {
  requestAuthOtp,
  resendSignupOtp,
  verifyAuthOtp,
  persistAuthCookies,
} from "@/services/auth";
import { toast } from "sonner";
import { heroContainerVariants, heroItemVariants } from "@/lib/motion.config";
import { CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { buyerReturnPath } from "@/lib/login-redirect";

function VerifyOtpContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Sign-ups land here with ?phone= or (email-only accounts) ?email=, plus
  // ?signup=1 so "Resend" re-sends the sign-up code instead of a login code.
  const emailPrefill = searchParams.get("email") ?? "";
  const prefill = searchParams.get("phone") ?? emailPrefill;
  const isEmail = Boolean(emailPrefill) && !searchParams.get("phone");
  const isSignup = searchParams.get("signup") === "1";
  const channelLabel = isEmail ? "email address" : "mobile number";

  const [identifier, setIdentifier] = React.useState(prefill);
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [sending, setSending] = React.useState(false);
  /** Set once a seller's application is submitted: the page shows the green confirmation. */
  const [submitted, setSubmitted] = React.useState<string | null>(null);
  const submittedOtpRef = React.useRef<string | null>(null);

  // One-time-code autofill supported on mobile browsers.

  const handleVerify = React.useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!identifier || !otp) {
      console.warn("[auth-ui][verify-otp] blocked submit", { hasPhone: Boolean(identifier), hasOtp: Boolean(otp) });
      toast.error(`Enter your ${channelLabel} and OTP.`);
      return;
    }

    setLoading(true);
    try {
      console.info("[auth-ui][verify-otp] submit", { phone: "[present]", otpLength: otp.length });
      const result = await verifyAuthOtp(
        isEmail ? { email: identifier, otp } : { phone: identifier, otp }
      );
      if (result.accessToken && result.refreshToken && result.user) {
        persistAuthCookies(result.accessToken, result.refreshToken, result.user);

        toast.success(isEmail ? "Email verified successfully." : "Number verified successfully.");

        const role = result.user.role?.toUpperCase();
        // Staff → dashboards; buyers → where they came from, else homepage.
        const staffDestination: Record<string, string> = {
          ADMIN: "/admin/dashboard",
          SUPER_ADMIN: "/admin/dashboard",
          SELLER: "/seller/dashboard",
        };

        router.push(staffDestination[role] ?? buyerReturnPath());
      } else {
        const message = result.message ?? "Your seller application has been submitted for approval.";
        toast.success(message);
        setSubmitted(message);
      }
    } catch (error) {
      console.error("[auth-ui][verify-otp] failed", error);
      toast.error(error instanceof Error ? error.message : "OTP failed");
    } finally {
      setLoading(false);
    }
  }, [identifier, isEmail, channelLabel, otp, router]);

  const handleResend = async () => {
    if (!identifier) {
      console.warn("[auth-ui][verify-otp] resend blocked", { hasPhone: false });
      toast.error(`Enter your ${channelLabel} first.`);
      return;
    }
    setSending(true);
    try {
      console.info("[auth-ui][verify-otp] resend", { phone: "[present]" });
      if (isSignup) {
        const result = await resendSignupOtp(isEmail ? { email: identifier } : { phone: identifier });
        toast.success(result.message);
      } else {
        const result = await requestAuthOtp({ identifier });
        toast.success(result.message);
      }
    } catch (error) {
      console.error("[auth-ui][verify-otp] resend failed", error);
      toast.error(error instanceof Error ? error.message : "OTP request failed");
    } finally {
      setSending(false);
    }
  };

  React.useEffect(() => {
    if (otp.length !== 6 || loading || submittedOtpRef.current === otp) {
      return;
    }
    submittedOtpRef.current = otp;
    void handleVerify({ preventDefault() {} } as React.FormEvent<HTMLFormElement>);
  }, [handleVerify, loading, otp]);

  if (submitted) {
    return (
      <div className="flex min-h-[calc(100vh-160px)] items-center justify-center bg-background px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          role="status"
          className="w-full max-w-lg rounded-2xl border border-emerald-300 bg-emerald-50 p-8 text-center shadow-sm dark:border-emerald-500/40 dark:bg-emerald-500/10"
        >
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-600" aria-hidden />
          <h1 className="mt-4 font-serif text-3xl font-normal text-emerald-800 dark:text-emerald-300">
            Application submitted for approval
          </h1>
          <p className="mt-3 text-base leading-relaxed text-emerald-900/80 dark:text-emerald-100/80">{submitted}</p>
          <p className="mt-2 text-sm text-emerald-900/70 dark:text-emerald-100/70">
            We have also sent a confirmation to your email. You can sign in once your account is approved.
          </p>
          <Button asChild className="mt-6 bg-emerald-600 text-white hover:bg-emerald-700" size="lg">
            <Link href="/login">Go to Seller Login</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-160px)] bg-background">
      <div className="mx-auto flex min-h-[calc(100vh-160px)] max-w-5xl flex-col items-center justify-center gap-14 px-6 py-16 lg:flex-row lg:gap-24">
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
            Verify Account
          </motion.p>
          <motion.h1
            variants={heroItemVariants}
            className="font-serif text-4xl font-light tracking-tight text-foreground sm:text-5xl mb-6"
          >
            Confirm your
            <br />
            <span className="italic">{channelLabel}</span>.
          </motion.h1>
          <motion.p
            variants={heroItemVariants}
            className="text-base leading-relaxed text-muted-foreground"
          >
            We sent a 6-digit OTP to your {channelLabel}. Enter it below to continue with your account.
          </motion.p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="w-full max-w-md"
        >
          <Card className="border-border-soft">
            <CardHeader className="space-y-3 pb-6">
              <CardTitle className="font-serif text-2xl font-normal">
                Verify OTP
              </CardTitle>
              <CardDescription>
                Enter your {channelLabel} and OTP to continue.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <form className="space-y-5" onSubmit={handleVerify}>
                <div className="space-y-2">
                  <Label htmlFor="identifier" required>
                    {isEmail ? "Email address" : "Mobile number"}
                  </Label>
                  <Input
                    id="identifier"
                    type={isEmail ? "email" : "tel"}
                    inputMode={isEmail ? "email" : "numeric"}
                    placeholder={isEmail ? "you@email.com" : "9876543210"}
                    value={identifier}
                    onChange={(event) =>
                      setIdentifier(isEmail ? event.target.value : event.target.value.replace(/\D/g, ""))
                    }
                    disabled={Boolean(prefill)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="otp" required>OTP</Label>
                  <Input
                    id="otp"
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))}
                    autoComplete="one-time-code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>
                <Button className="w-full" size="lg" disabled={loading}>
                  {loading ? "Verifying..." : "Verify & Continue"}
                </Button>
              </form>
              <Button
                variant="outline"
                className="w-full"
                disabled={sending}
                onClick={handleResend}
              >
                {sending ? "Sending OTP..." : "Resend OTP"}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

export default function VerifyOtpPage() {
  return (
    <React.Suspense fallback={null}>
      <VerifyOtpContent />
    </React.Suspense>
  );
}
