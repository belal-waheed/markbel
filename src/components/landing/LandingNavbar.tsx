import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Github, Menu, X as CloseIcon } from 'lucide-react'
import MarkbelLogo from '../MarkbelLogo.js'

export interface LandingNavbarProps {
  token?: string | null
  onLaunchApp: () => void
  onSignIn: () => void
}

export function LandingNavbar({
  token,
  onLaunchApp,
  onSignIn
}: LandingNavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const handleLogoClick = () => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const closeMobileMenu = () => {
    setMobileMenuOpen(false)
  }

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-bg-main)]/90 backdrop-blur-md border-b border-[var(--color-border-default)] transition-colors">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer select-none"
          onClick={handleLogoClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              handleLogoClick()
            }
          }}
          aria-label="Scroll to top"
        >
          <MarkbelLogo size={34} className="shadow-xs" />
          <div className="flex flex-col">
            <span className="font-bold text-base leading-tight tracking-tight text-[var(--color-text-primary)]">
              Markbel
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[var(--color-text-muted)]">
              Bookmarks Vault
            </span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-[var(--color-text-muted)]">
          <a href="#demo" className="hover:text-[var(--color-text-primary)] transition-colors">
            Live Preview
          </a>
          <a href="#features" className="hover:text-[var(--color-text-primary)] transition-colors">
            Pillars
          </a>
          <a href="#comparison" className="hover:text-[var(--color-text-primary)] transition-colors">
            Comparison
          </a>
          <a href="#platforms" className="hover:text-[var(--color-text-primary)] transition-colors">
            Clients
          </a>
          <a href="#faq" className="hover:text-[var(--color-text-primary)] transition-colors">
            FAQ
          </a>
          <a
            href="https://github.com/belal-waheed/markbel"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 hover:text-[var(--color-text-primary)] transition-colors"
          >
            <Github className="w-4 h-4" />
            <span>GitHub</span>
          </a>
        </nav>

        <div className="flex items-center gap-2.5">
          {token ? (
            <button
              onClick={onLaunchApp}
              className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
            >
              <span>Enter Vault</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <>
              <button
                onClick={onSignIn}
                className="hidden sm:inline-flex text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
              >
                Sign In
              </button>
              <button
                onClick={onLaunchApp}
                className="btn-primary px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 shadow-xs cursor-pointer"
              >
                <span>Launch Vault</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Mobile Hamburger Button */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="md:hidden p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-element)] transition-colors cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <CloseIcon className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden border-b border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-4 py-4 space-y-3 overflow-hidden shadow-lg"
          >
            <nav className="flex flex-col space-y-2 text-sm font-semibold">
              <a
                href="#demo"
                onClick={closeMobileMenu}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
              >
                Live Preview
              </a>
              <a
                href="#features"
                onClick={closeMobileMenu}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
              >
                Architectural Pillars
              </a>
              <a
                href="#comparison"
                onClick={closeMobileMenu}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
              >
                Architecture Comparison
              </a>
              <a
                href="#platforms"
                onClick={closeMobileMenu}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
              >
                Platforms & Clients
              </a>
              <a
                href="#faq"
                onClick={closeMobileMenu}
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] transition-colors"
              >
                FAQ
              </a>
              <a
                href="https://github.com/belal-waheed/markbel"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-2 rounded-lg hover:bg-[var(--color-bg-element)] text-[var(--color-text-primary)] flex items-center gap-2"
              >
                <Github className="w-4 h-4" />
                <span>GitHub Repository</span>
              </a>
            </nav>

            <div className="pt-2 border-t border-[var(--color-border-default)] flex gap-2">
              <button
                onClick={() => {
                  closeMobileMenu()
                  onSignIn()
                }}
                className="flex-1 btn-secondary py-2.5 text-xs font-semibold rounded-lg text-center"
              >
                Sign In
              </button>
              <button
                onClick={() => {
                  closeMobileMenu()
                  onLaunchApp()
                }}
                className="flex-1 btn-primary py-2.5 text-xs font-semibold rounded-lg text-center"
              >
                Launch Vault
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  )
}

export default LandingNavbar
