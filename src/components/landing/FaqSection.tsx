import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shield, ChevronDown } from 'lucide-react'
import { FAQ_ITEMS } from './landingConstants.js'

export interface FaqItem {
  question: string
  answer: string
}

export interface FaqSectionProps {
  items?: FaqItem[]
}

export function FaqSection({ items = FAQ_ITEMS }: FaqSectionProps) {
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0)

  const toggleFaq = (index: number) => {
    setOpenFaqIndex((prev) => (prev === index ? null : index))
  }

  return (
    <section id="faq" className="py-20 max-w-4xl mx-auto px-4 sm:px-6">
      <div className="text-center max-w-2xl mx-auto mb-14">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
          <Shield className="w-3.5 h-3.5" />
          <span>Questions & Answers</span>
        </div>
        <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
          Frequently Asked Questions
        </h2>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Everything you need to know about Markbel storage, syncing, and privacy.
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item, idx) => {
          const isOpen = openFaqIndex === idx
          return (
            <div
              key={idx}
              className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] overflow-hidden shadow-xs transition-colors"
            >
              <button
                type="button"
                onClick={() => toggleFaq(idx)}
                className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 font-semibold text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors cursor-pointer"
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <ChevronDown
                  className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 shrink-0 ${
                    isOpen ? 'rotate-180 text-[var(--color-accent)]' : ''
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 pt-1 text-xs text-[var(--color-text-muted)] leading-relaxed border-t border-[var(--color-border-default)]">
                      {item.answer}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default FaqSection
