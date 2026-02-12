'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, SendHorizonal } from 'lucide-react';

import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import GoogleSignInBtn from '@/utils/google-sign-in-btn';
import GithubSignIn from '@/utils/github-sign-in-btn';
import { Loader } from '@/components/elements/loader';
import { postAudit } from '@/app/api/global-api';

interface FormData {
  email: string;
  otp: string;
}

const stepCardVariants = {
  initial: { opacity: 0, y: 16, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -16, scale: 0.98 },
};

const InnerLoginForm: React.FC = () => {
  const REDIRECT_URL = process.env.NEXT_PUBLIC_REDIRECT_URL;
  const [step, setStep] = useState<1 | 2>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Starting Audit');
  const [otpHint, setOtpHint] = useState('');

  const form = useForm<FormData>();
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = form;

  const emailValue = watch('email');
  const params = useSearchParams();
  const router = useRouter();

  const url = params.get('url');
  const subscriptionId = params.get('subscriptionId');
  const subscriptionType = params.get('subscriptionType');

  /* ---------- GitHub callback / URL error handling ---------- */
  useEffect(() => {
    const error = params.get('error');
    const sessionCode = params.get('session');

    if (error) {
      toast.error(error);
    } else if (sessionCode) {
      setLoadingMessage('Verifying Github...');
      setIsSubmitting(true);
      githubLogin(sessionCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const githubLogin = async (code: string) => {
    try {
      const responsePromise = axios.post(
        '/v1/user/auth/github/verify',
        { code },
        { withCredentials: true }
      );

      toast.promise(responsePromise, {
        loading: 'Verifying Github...',
        success: (res) => {
          const data = (res as any)?.data;
          const hasUrl = !!params.get('url');

          if (hasUrl && data?.submitUrl?.uuid) {
            setLoadingMessage('Starting Audit');
            setIsSubmitting(true);
            setTimeout(() => {
              router.push(`${REDIRECT_URL}/reports/${data.submitUrl.uuid}`);
            }, 1500);
          } else {
            router.push(`${REDIRECT_URL}`);
          }

          return 'Login successful!';
        },
        error: () => {
          setIsSubmitting(false);
          return 'Login failed';
        },
      });
    } catch {
      setIsSubmitting(false);
    }
  };

  /* ------------------------------ OTP Flow ------------------------------ */

  const handleSendOtp = async (email: string) => {
    setIsLoading(true);
    try {
      const response = await axios.post('/v1/user/auth/otp/send', { email });

      if (response.status === 200) {
        toast.success('OTP sent successfully!');
        setOtpHint(`We sent a 6-digit code to ${email.toLowerCase()}.`);
        setStep(2);
      } else {
        toast.error(response.data.message || 'Failed to send OTP');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'An error occurred while sending OTP');
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!emailValue) {
      toast.error('Please enter your email before requesting a new code.');
      return;
    }
    await handleSendOtp(emailValue.toLowerCase());
  };

  const handleEditEmail = () => {
    setStep(1);
    setValue('otp', '');
    setOtpHint('');
  };

  const submitAudit = async (audit: string) => {
    setIsSubmitting(true);
    try {
      await postAudit({ url: audit });
    } catch (err) {
      console.log(err);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Step 1 → send OTP
    if (step === 1) {
      if (!data.email) {
        toast.error('Please enter your email');
        return;
      }
      await handleSendOtp(data.email.toLowerCase());
      return;
    }

    // Step 2 → verify OTP
    if (!data.otp || data.otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setIsLoading(true);

    try {
      const payload: any = {
        email: data.email.toLowerCase(),
        otp: data.otp.toLowerCase(),
      };

      if (subscriptionId) payload.subscriptionId = subscriptionId;
      if (subscriptionType) payload.subscriptionType = subscriptionType;
      if (url) payload.url = url;

      const response = await axios.post('/v1/user/auth/otp/verify', payload, {
        withCredentials: true,
      });

      if (response.status === 200) {
        toast.success('Login successful!');

        const hasUrl = !!params.get('url');
        const submitUuid = response.data?.submitUrl?.uuid;

        if (hasUrl && submitUuid) {
          setLoadingMessage('Starting Audit');
          setIsSubmitting(true);
          setTimeout(() => {
            router.push(`${REDIRECT_URL}/reports/${submitUuid}`);
          }, 1500);
        } else {
          router.push(`${REDIRECT_URL}`);
        }
      } else {
        toast.error(response.data.message || 'Login failed');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Login failed');
      } else {
        toast.error('An unexpected error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  /* -------------------------- Submitting Loader -------------------------- */

  if (isSubmitting) {
    return (
      <div className="flex h-64 w-full items-center justify-center rounded-3xl bg-white shadow-sm">
        <Loader message={loadingMessage} isLoading={isSubmitting} />
      </div>
    );
  }

  /* --------------------------------- UI --------------------------------- */

  return (
    <motion.div
      className="w-full rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur sm:p-6 lg:p-7"
      initial={{ opacity: 0, y: 10, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl">
          Login to Scanerio
        </h2>
        <p className="mt-1 text-xs text-slate-500 sm:text-sm">
          Use your work email to receive a one-time magic code, or continue with Google/GitHub.
        </p>
      </div>

      {/* Step indicator */}
      <div className="mb-4 flex items-center justify-center gap-3 text-[11px] text-slate-500 sm:justify-start">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
              step === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            1
          </span>
          <span className={`${step === 1 ? 'text-slate-900' : ''}`}>Email</span>
        </div>
        <div className="h-[1px] w-9 bg-slate-200" />
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
              step === 2 ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}
          >
            2
          </span>
          <span className={`${step === 2 ? 'text-slate-900' : ''}`}>Verify</span>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col">
        {/* Step content (only one visible) */}
        <div className="relative mb-4">
          <AnimatePresence mode="wait">
            {/* STEP 1: EMAIL */}
            {step === 1 && (
              <motion.div
                key="step-email"
                variants={stepCardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Step 1 · Work email
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  We&apos;ll send a one-time code to your email.
                </p>

                <div className="mt-4">
                  <label
                    htmlFor="email"
                    className="mb-1 block text-xs font-medium text-slate-700"
                  >
                    Work email
                  </label>
                  <div className="relative flex items-center rounded-xl border border-slate-200 bg-white px-2 py-1 focus-within:ring-2 focus-within:ring-emerald-400">
                    <Mail className="ml-2 h-4 w-4 text-slate-400" />
                    <input
                      type="email"
                      id="email"
                      {...register('email', { required: true })}
                      placeholder="you@company.com"
                      className="w-full bg-transparent px-3 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <motion.span
                      className="mt-1 block text-[11px] text-red-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    >
                      Email is required
                    </motion.span>
                  )}
                </div>
              </motion.div>
            )}

            {/* STEP 2: OTP */}
            {step === 2 && (
              <motion.div
                key="step-otp"
                variants={stepCardVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4"
              >
                <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                  Step 2 · Verify code
                </p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  Enter the 6-digit code from your email.
                </p>
                {otpHint && (
                  <p className="mt-1 text-[11px] font-medium text-emerald-600">
                    {otpHint}
                  </p>
                )}

                <div className="mt-4 flex justify-center">
                  <InputOTP
                    maxLength={6}
                    {...register('otp', { required: true, minLength: 6 })}
                    onChange={(value) => setValue('otp', value)}
                    disabled={isLoading}
                    className="border-none"
                  >
                    <InputOTPGroup className="gap-2 sm:gap-3 *:data-[slot=input-otp-slot]:rounded-2xl *:data-[slot=input-otp-slot]:border *:data-[slot=input-otp-slot]:border-slate-200 *:data-[slot=input-otp-slot]:bg-white *:data-[slot=input-otp-slot]:text-lg *:data-[slot=input-otp-slot]:font-semibold">
                      {[...Array(6)].map((_, index) => (
                        <InputOTPSlot
                          key={index}
                          index={index}
                          className="h-10 w-10 text-center text-slate-900 sm:h-11 sm:w-11"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {errors.otp && (
                  <motion.span
                    className="mt-1 block text-[11px] text-red-500"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    Please enter a valid 6-digit OTP
                  </motion.span>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={isLoading}
                    className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Resend code
                  </button>
                  <span className="hidden text-slate-300 sm:inline">•</span>
                  <button
                    type="button"
                    onClick={handleEditEmail}
                    className="font-semibold text-slate-600 underline-offset-4 transition hover:text-slate-900"
                  >
                    Change email
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Primary CTA */}
        <motion.button
          type="submit"
          disabled={isLoading}
          className="flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-2.5 text-sm font-medium tracking-wide text-white shadow-sm transition hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60"
          whileHover={!isLoading ? { scale: 1.02 } : {}}
          whileTap={!isLoading ? { scale: 0.98 } : {}}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : step === 1 ? (
            'Send magic code'
          ) : (
            'Verify & continue'
          )}
          {!isLoading && <SendHorizonal className="ml-2 h-5 w-5" />}
        </motion.button>

        {/* Divider */}
        <div className="mt-5 flex items-center justify-between text-[11px] text-slate-400">
          <span className="w-1/5 border-b border-slate-200" />
          <p className="mx-2">or continue with</p>
          <span className="w-1/5 border-b border-slate-200" />
        </div>

        {/* Social logins */}
        <div className="mt-4 grid grid-cols-1 gap-3">
          <GoogleSignInBtn title="Google" />
          <GithubSignIn title="Github" />
        </div>

        {/* Tiny footer */}
        <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-400">
          By signing in, you agree to our{' '}
          <a
            href="https://www.scanerio.com/terms"
            className="underline underline-offset-2"
          >
            Terms of Service
          </a>{' '}
          and{' '}
          <a
            href="https://www.scanerio.com/privacypolicy"
            className="underline underline-offset-2"
          >
            Privacy Policy
          </a>
          .
        </p>
      </form>
    </motion.div>
  );
};

export default function LoginForm() {
  // Suspense wrapper in case you want future async pieces
  return (
    <Suspense fallback={<div className="py-10 text-center text-sm text-slate-500">Loading…</div>}>
      <InnerLoginForm />
    </Suspense>
  );
}
