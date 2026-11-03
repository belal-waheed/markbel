import React from 'react'
import { motion } from 'framer-motion'
import { CheckCircle2, X, Scale } from 'lucide-react'
import {
  ARCHITECTURE_COMPARISONS,
  type ComparisonFeature
} from './landingConstants.js'

export interface ComparisonSectionProps {
  comparisons?: ComparisonFeature[]
}

export function ComparisonSection({
  comparisons = ARCHITECTURE_COMPARISONS
}: ComparisonSectionProps) {
  return (
    <section id="comparison" className="py-20 border-b border-[var(--color-border-default)] bg-[var(--color-bg-main)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-[var(--color-bg-element)] border border-[var(--color-border-default)] text-xs font-semibold text-[var(--color-accent)] mb-3">
            <Scale className="w-3.5 h-3.5" />
            <span>Architecture Matrix</span>
          </div>
          <h2 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">
            How Markbel Compares
          </h2>
          <p className="mt-3 text-sm text-[var(--color-text-muted)]">
            A side-by-side technical breakdown between Markbel and traditional cloud bookmark managers.
          </p>
        </div>

        {/* Desktop Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.4 }}
          className="hidden md:block rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-lg overflow-hidden"
        >
          <div className="grid grid-cols-12 bg-[var(--color-bg-element)] border-b border-[var(--color-border-default)] px-6 py-4 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            <div className="col-span-4">Capability & Area</div>
            <div className="col-span-4 text-[var(--color-accent)] flex items-center gap-1.5">
              <span>Markbel Architecture</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30 lowercase font-mono">
                offline-first
              </span>
            </div>
            <div className="col-span-4 text-[var(--color-text-muted)]">Traditional Cloud Bookmarkers</div>
          </div>

          <div className="divide-y divide-[var(--color-border-default)]">
            {comparisons.map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-12 px-6 py-4 items-start gap-4 hover:bg-[var(--color-bg-hover)] transition-colors text-xs"
              >
                <div className="col-span-4 pr-2">
                  <div className="font-semibold text-sm text-[var(--color-text-primary)]">{item.feature}</div>
                  <div className="text-[11px] font-mono text-[var(--color-text-muted)] mt-0.5">
                    {item.category}
                  </div>
                </div>

                <div className="col-span-4 pr-4">
                  <div className="flex items-center gap-2 font-bold text-[var(--color-text-primary)]">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>{item.markbel.value}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {item.markbel.detail}
                  </p>
                </div>

                <div className="col-span-4">
                  <div className="flex items-center gap-2 font-medium text-[var(--color-text-muted)]">
                    <X className="w-4 h-4 text-zinc-400 shrink-0" />
                    <span>{item.traditional.value}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {item.traditional.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Mobile Comparison Cards */}
        <div className="md:hidden space-y-4">
          {comparisons.map((item, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.3 }}
              className="p-5 rounded-2xl bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] shadow-xs space-y-3.5"
            >
              <div>
                <span className="text-[10px] font-mono uppercase text-[var(--color-text-muted)] font-semibold">
                  {item.category}
                </span>
                <h3 className="text-base font-bold text-[var(--color-text-primary)]">{item.feature}</h3>
              </div>

              {/* Markbel Advantage */}
              <div className="p-3.5 rounded-xl bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-[var(--color-accent)]">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Markbel: {item.markbel.value}</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  {item.markbel.detail}
                </p>
              </div>

              {/* Traditional Cloud */}
              <div className="p-3 rounded-xl bg-[var(--color-bg-element)] border border-[var(--color-border-default)] space-y-1">
                <div className="flex items-center gap-2 font-semibold text-xs text-[var(--color-text-muted)]">
                  <X className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span>Others: {item.traditional.value}</span>
                </div>
                <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                  {item.traditional.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default ComparisonSection
