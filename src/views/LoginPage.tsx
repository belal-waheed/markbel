import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Mail, Lock, User, ArrowRight, Loader2, Eye, EyeOff, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react'
import { useAuth } from '../lib/auth.js'
import { api } from '../lib/api.js'
import MarkbelLogo from '../components/MarkbelLogo.js'

type AuthMode = 'login' | 'signup' | 'forgot_request' | 'forgot_reset'

export default function LoginPage() {
  const [mode, setMode] = useState<AuthMode>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [resetCode, setResetCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const { login, signup } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirectUrl = searchParams.get('redirect') || '/'

  const handleSubmit = async (e: React.FormEvent) => {
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
      } else if (mode === 'forgot_request') {
        const res = await api.post<{ success: boolean; message: string; devCode?: string; emailDelivered?: boolean }>(
          '/auth/forgot-password',
          { email }
        )
        if (res.devCode) {
          setResetCode(res.devCode)
        }
        setSuccessMessage(
          res.emailDelivered
            ? `Verification code sent to ${email}. Please check your email inbox.`
            : res.devCode
            ? `Verification code generated: ${res.devCode}`
            : 'If an account exists, a 6-digit verification code has been sent.'
        )
        setMode('forgot_reset')
      } else if (mode === 'forgot_reset') {
        await api.post('/auth/reset-password', {
          email,
          code: resetCode,
          newPassword,
        })
        setSuccessMessage('Password reset successfully. Please sign in with your new password.')
        setMode('login')
        setPassword('')
        setResetCode('')
        setNewPassword('')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Authentication operation failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const switchMode = (newMode: AuthMode) => {
    setMode(newMode)
    setError('')
    setSuccessMessage('')
  }

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
          <div className="text-center mb-6 mt-1">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)] tracking-tight">
              {mode === 'signup' && 'Create Account'}
              {mode === 'login' && 'Welcome Back'}
              {mode === 'forgot_request' && 'Reset Password'}
              {mode === 'forgot_reset' && 'Enter Verification Code'}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--color-text-muted)] mt-1.5 font-medium">
              {mode === 'signup' && 'Create a unified links vault with cloud sync'}
              {mode === 'login' && 'Sign in to access your saved links across devices'}
              {mode === 'forgot_request' && 'Enter your account email to receive a 6-digit verification code'}
              {mode === 'forgot_reset' && 'Enter the 6-digit verification code and your new password'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name Input (Signup only) */}
            {mode === 'signup' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                transition={{ duration: 0.2 }}
              >
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">Name</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full studio-input px-4 py-2.5 pl-11 text-sm"
                    required={mode === 'signup'}
                  />
                </div>
              </motion.div>
            )}

            {/* Email Input (All modes except reset step if already set) */}
            {mode !== 'forgot_reset' && (
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
            )}

            {/* Verification Code Input (Reset step only) */}
            {mode === 'forgot_reset' && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                  6-Digit Numeric Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder="123456"
                    value={resetCode}
                    maxLength={6}
                    onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ''))}
                    className="w-full studio-input px-4 py-2.5 pl-11 text-sm tracking-widest font-mono font-bold text-center"
                    required
                  />
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
                  Enter the 6-digit number sent to your email.
                </p>
              </div>
            )}

            {/* Password Input (Login / Signup) */}
            {(mode === 'login' || mode === 'signup') && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-[var(--color-text-muted)]">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => switchMode('forgot_request')}
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
            )}

            {/* New Password Input (Reset mode only) */}
            {mode === 'forgot_reset' && (
              <div>
                <label className="text-xs font-semibold text-[var(--color-text-muted)] mb-1.5 block">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-muted)]" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full studio-input px-4 py-2.5 pl-11 pr-11 text-sm"
                    required
                    minLength={4}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] rounded"
                    title={showNewPassword ? 'Hide password' : 'Show password'}
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            {/* Success Feedback Message */}
            {successMessage && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3 font-semibold flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{successMessage}</span>
              </motion.div>
            )}

            {/* Error Feedback Message */}
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-xs text-[var(--color-status-error)] bg-red-50 border border-red-200 rounded-md p-3 font-semibold text-center"
              >
                {error}
              </motion.p>
            )}

            {/* Submit Action Button */}
            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 btn-primary py-2.5 px-4 active:scale-[0.98] mt-6 font-bold"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span className="text-sm">
                    {mode === 'signup' && 'Create Account'}
                    {mode === 'login' && 'Sign In'}
                    {mode === 'forgot_request' && 'Send Verification Code'}
                    {mode === 'forgot_reset' && 'Update Password'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Navigation Links */}
          <div className="mt-6 space-y-3 text-center border-t border-[var(--color-border-default)] pt-4">
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => switchMode('signup')}
                className="text-xs sm:text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer group font-medium block w-full"
              >
                Don't have an account? <span className="text-[var(--color-accent)] group-hover:underline font-bold ml-1">Sign Up</span>
              </button>
            )}

            {mode === 'signup' && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs sm:text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer group font-medium block w-full"
              >
                Already have an account? <span className="text-[var(--color-accent)] group-hover:underline font-bold ml-1">Sign In</span>
              </button>
            )}

            {(mode === 'forgot_request' || mode === 'forgot_reset') && (
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs sm:text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors font-semibold flex items-center justify-center gap-1.5 w-full"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Sign In</span>
              </button>
            )}

            {/* Continue as Guest Button */}
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] underline py-1 block w-full transition-colors"
            >
              Continue as Guest (Offline Local Storage)
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-[var(--color-text-muted)] mt-6 tracking-wide">
          Understated, high-performance link vault
        </p>
      </motion.div>
    </div>
  )
}

