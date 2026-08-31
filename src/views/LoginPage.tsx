import React, { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import MarkbelLogo from '../components/MarkbelLogo.js'
import { OtpInput } from '../components/OtpInput.js'

type AuthMode = 'login' | 'signup' | 'forgot_request' | 'forgot_otp' | 'forgot_new_password'

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 40 : -40,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.25, 1, 0.5, 1] },
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 40 : -40,
    opacity: 0,
    transition: { duration: 0.18 },
  }),
}

function calculatePasswordStrength(pass: string): { score: number; label: string; color: string } {
  if (!pass) return { score: 0, label: '', color: '' }
  let score = 0
  if (pass.length >= 6) score++
  if (pass.length >= 8) score++
  if (/[A-Z]/.test(pass) && /[a-z]/.test(pass)) score++
  if (/[0-9]/.test(pass)) score++
  if (/[^A-Za-z0-9]/.test(pass)) score++

  if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500' }
  if (score <= 3) return { score: 2, label: 'Fair', color: 'bg-amber-500' }
  return { score: 3, label: 'Strong', color: 'bg-emerald-500' }
}

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [direction, setDirection] = useState(1)

  // Form Fields
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resendCooldown, setResendCooldown] = useState(0)

  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'

  // Resend Countdown Timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown((prev) => prev - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [resendCooldown])

  const switchMode = (newMode: AuthMode, dir = 1) => {
    setDirection(dir)
    setMode(newMode)
    setError('')
    setSuccessMessage('')
  }

  // Handle Step 1: Request Code
  const handleRequestCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setError('')
    setSubmitting(true)

    try {
      const res = await api.post<{ success: boolean; message: string; devCode?: string; emailDelivered?: boolean }>(
        '/auth/forgot-password',
        { email }
      )
      setResetCode('')
      setResendCooldown(60)
      setSuccessMessage(
        res.emailDelivered
          ? `A 6-digit code was sent to ${email}.`
          : res.devCode
          ? `Sandbox code: ${res.devCode}`
          : 'Verification code sent to your email.'
      )
      switchMode('forgot_otp', 1)
    } catch (err: any) {
      setError(err.message || 'Failed to send reset code. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Step 2: Verify Code
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = codeToVerify || resetCode
    if (code.length < 6) {
      setError('Please enter the full 6-digit verification code.')
      return
    }
    setError('')
    setSubmitting(true)

    try {
      await api.post('/auth/verify-code', { email, code })
      setError('')
      setSuccessMessage('Code verified! Please choose your new password.')
      switchMode('forgot_new_password', 1)
    } catch (err: any) {
      setError(err.message || 'Invalid or expired verification code.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.')
      return
    }
    if (confirmPassword && newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      await api.post('/auth/reset-password', {
        email,
        code: resetCode,
        newPassword,
      })
      setSuccessMessage('Password reset successfully! You can now sign in.')
      setPassword('')
      setResetCode('')
      setNewPassword('')
      setConfirmPassword('')
      switchMode('login', -1)
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Main Login / Signup
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setSubmitting(true)

    try {
      if (mode === 'signup') {
        await signup(name, email, password)
        navigate(redirectUrl, { replace: true })
      } else if (mode === 'login') {
        await login(email, password)
        navigate(redirectUrl, { replace: true })
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const isForgotFlow = mode.startsWith('forgot_')
  const currentStep = mode === 'forgot_request' ? 1 : mode === 'forgot_otp' ? 2 : mode === 'forgot_new_password' ? 3 : 0
  const passStrength = calculatePasswordStrength(newPassword)

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-default)] p-4 relative overflow-hidden text-[var(--color-text-primary)] font-sans">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo Header */}
        <div className="flex flex-col items-center justify-center gap-2 mb-8 text-center">
          <MarkbelLogo size={56} className="text-[var(--color-accent)] drop-shadow-sm" />
          <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)] mt-1.5 uppercase">
            Markbel
          </h1>
          <p className="text-[10px] text-[var(--color-text-muted)] tracking-wide font-semibold uppercase bg-[var(--color-bg-element)] border border-[var(--color-border-default)] px-3 py-1 mt-1 rounded-md">
            Bookmarks Vault
          </p>
        </div>

        {/* Studio Card Container */}
        <div className="studio-card p-6 sm:p-8">
          {/* Multi-Step Wizard Progress Bar for Forgot Password */}
          {isForgotFlow && (
            <div className="flex items-center justify-center gap-2 mb-6 pb-2 border-b border-[var(--color-border)]">
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  currentStep === 1
                    ? 'bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/20'
                    : currentStep > 1
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-[var(--color-bg-element)] text-[var(--color-text-muted)]'
                }`}
              >
                {currentStep > 1 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>1</span>}
                <span className="ml-0.5">Email</span>
              </div>
              <div className={`w-4 h-0.5 ${currentStep >= 2 ? 'bg-emerald-500' : 'bg-[var(--color-border)]'}`} />
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  currentStep === 2
                    ? 'bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/20'
                    : currentStep > 2
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-[var(--color-bg-element)] text-[var(--color-text-muted)]'
                }`}
              >
                {currentStep > 2 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>2</span>}
                <span className="ml-0.5">Verify</span>
              </div>
              <div className={`w-4 h-0.5 ${currentStep >= 3 ? 'bg-emerald-500' : 'bg-[var(--color-border)]'}`} />
              <div
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all ${
                  currentStep === 3
                    ? 'bg-[var(--color-accent)] text-white ring-2 ring-[var(--color-accent)]/20'
                    : 'bg-[var(--color-bg-element)] text-[var(--color-text-muted)]'
                }`}
              >
                <span>3</span>
                <span className="ml-0.5">Password</span>
              </div>
            </div>
          )}

          {/* Heading Section */}
          <div className="text-center mb-6 mt-1">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {mode === 'signup' && 'Create Account'}
              {mode === 'login' && 'Welcome Back'}
              {mode === 'forgot_request' && 'Reset Your Password'}
              {mode === 'forgot_otp' && 'Enter Verification Code'}
              {mode === 'forgot_new_password' && 'Create New Password'}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1.5 font-medium">
              {mode === 'signup' && 'Create a unified links vault with cloud sync'}
              {mode === 'login' && 'Sign in to access your saved links across devices'}
              {mode === 'forgot_request' && 'Enter your email to receive a 6-digit recovery code'}
              {mode === 'forgot_otp' && `We sent a 6-digit code to ${email}`}
              {mode === 'forgot_new_password' && 'Choose a strong password for your account'}
            </p>
          </div>

          <AnimatePresence mode="wait" custom={direction}>
            {/* STAGE 1: LOGIN / SIGNUP */}
            {(mode === 'login' || mode === 'signup') && (
              <motion.form
                key={mode}
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleAuthSubmit}
                className="space-y-4"
              >
                {mode === 'signup' && (
                  <div>
                    <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Name</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                      <input
                        type="text"
                        placeholder="Your name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full studio-input px-4 py-2.5 pl-11 text-sm"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type="email"
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full studio-input px-4 py-2.5 pl-11 text-sm"
                      required
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-[var(--color-text-muted)]">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => switchMode('forgot_request', 1)}
                        className="text-xs text-[var(--color-accent)] hover:underline font-medium"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full studio-input px-4 py-2.5 pl-11 pr-11 text-sm"
                      required
                      minLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded"
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full studio-button-primary py-2.5 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm mt-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>{mode === 'signup' ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STAGE 2: FORGOT - STEP 1 (ENTER EMAIL) */}
            {mode === 'forgot_request' && (
              <motion.form
                key="forgot_request"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleRequestCode}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                    Account Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type="email"
                      placeholder="name@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full studio-input px-4 py-2.5 pl-11 text-sm"
                      autoFocus
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !email}
                  className="w-full studio-button-primary py-2.5 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm mt-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Send Verification Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => switchMode('login', -1)}
                    className="inline-flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </motion.form>
            )}

            {/* STAGE 3: FORGOT - STEP 2 (ENTER 6-DIGIT OTP) */}
            {mode === 'forgot_otp' && (
              <motion.div
                key="forgot_otp"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                className="space-y-4"
              >
                <div className="text-center">
                  <OtpInput
                    value={resetCode}
                    onChange={(val) => {
                      setResetCode(val)
                      setError('')
                    }}
                    onComplete={(code) => handleVerifyOtp(code)}
                    disabled={submitting}
                    error={Boolean(error)}
                  />
                  <p className="text-xs text-[var(--color-text-muted)] mt-2">
                    Enter the 6-digit code sent to your inbox.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={submitting || resetCode.length < 6}
                  className="w-full studio-button-primary py-2.5 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm mt-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Verify Code</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>

                {/* Resend & Change Email Row */}
                <div className="flex items-center justify-between pt-2 text-xs border-t border-[var(--color-border)]">
                  <button
                    type="button"
                    onClick={() => switchMode('forgot_request', -1)}
                    className="inline-flex items-center gap-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-medium transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change Email</span>
                  </button>

                  <button
                    type="button"
                    disabled={resendCooldown > 0 || submitting}
                    onClick={handleRequestCode}
                    className="inline-flex items-center gap-1.5 text-[var(--color-accent)] hover:underline font-medium disabled:opacity-50 disabled:no-underline"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${submitting ? 'animate-spin' : ''}`} />
                    <span>{resendCooldown > 0 ? `Resend code (${resendCooldown}s)` : 'Resend code'}</span>
                  </button>
                </div>
              </motion.div>
            )}

            {/* STAGE 4: FORGOT - STEP 3 (NEW PASSWORD) */}
            {mode === 'forgot_new_password' && (
              <motion.form
                key="forgot_new_password"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                onSubmit={handleResetPassword}
                className="space-y-4"
              >
                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="At least 6 characters"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full studio-input px-4 py-2.5 pl-11 pr-11 text-sm"
                      autoFocus
                      required
                      minLength={4}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>

                  {/* Password Strength Indicator */}
                  {newPassword && (
                    <div className="mt-2 space-y-1">
                      <div className="flex gap-1.5 h-1.5 w-full">
                        <div
                          className={`flex-1 rounded-full transition-all ${
                            passStrength.score >= 1 ? passStrength.color : 'bg-[var(--color-bg-element)]'
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-full transition-all ${
                            passStrength.score >= 2 ? passStrength.color : 'bg-[var(--color-bg-element)]'
                          }`}
                        />
                        <div
                          className={`flex-1 rounded-full transition-all ${
                            passStrength.score >= 3 ? passStrength.color : 'bg-[var(--color-bg-element)]'
                          }`}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-[var(--color-text-muted)]">
                        <span>Strength</span>
                        <span className="font-semibold">{passStrength.label}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      placeholder="Repeat new password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full studio-input px-4 py-2.5 pl-11 text-sm"
                      required
                      minLength={4}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || !newPassword}
                  className="w-full studio-button-primary py-2.5 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm mt-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Update Password & Sign In</span>
                      <CheckCircle2 className="w-4 h-4" />
                    </>
                  )}
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Feedback Alerts */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs flex items-center gap-2"
            >
              <span>{error}</span>
            </motion.div>
          )}

          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </motion.div>
          )}

          {/* Mode Switcher Footer */}
          {!isForgotFlow && (
            <div className="mt-6 pt-4 border-t border-[var(--color-border-default)] text-center">
              <p className="text-xs text-[var(--color-text-muted)]">
                {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchMode(mode === 'login' ? 'signup' : 'login', mode === 'login' ? 1 : -1)}
                  className="text-[var(--color-accent)] font-semibold hover:underline"
                >
                  {mode === 'login' ? 'Sign up' : 'Sign in'}
                </button>
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  )
}
