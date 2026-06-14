'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Step1Upload } from '@/components/comparador/Step1Upload'
import { Step2Results } from '@/components/comparador/Step2Results'
import { Step3Form } from '@/components/comparador/Step3Form'
import { Toaster } from '@/components/ui/toaster'
import type { InvoiceAnalysis, ComparadorStep } from '@/types'
import { cn } from '@/lib/utils'

const STEPS = [
  { n: 1, label: 'Sube tu factura' },
  { n: 2, label: 'Tu ahorro' },
  { n: 3, label: 'Recibe informe' },
]

export default function ComparadorPage() {
  const [step, setStep] = useState<ComparadorStep>(1)
  const [invoiceData, setInvoiceData] = useState<InvoiceAnalysis | null>(null)

  return (
    <>
      <Navbar />
      <main className="min-h-screen pt-16 pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto py-10">
          {/* Hero text */}
          <div className="text-center mb-10">
            <p className="text-[#00E676] text-sm uppercase tracking-widest mb-2">Análisis gratuito</p>
            <h1 className="text-3xl font-bold text-white">Comparador de tarifas</h1>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-0 mb-12">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    'w-9 h-9 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-colors',
                    step > s.n  ? 'bg-[#00E676] border-[#00E676] text-black'
                    : step === s.n ? 'border-[#00E676] text-[#00E676]'
                    : 'border-[#2A2A2A] text-[#6B7280]'
                  )}>
                    {step > s.n ? <Check className="w-4 h-4" /> : s.n}
                  </div>
                  <span className={cn('text-xs hidden sm:block', step === s.n ? 'text-white' : 'text-[#6B7280]')}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={cn('h-0.5 w-16 sm:w-24 mx-2 mb-5 transition-colors', step > s.n ? 'bg-[#00E676]' : 'bg-[#1F1F1F]')} />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step1Upload onComplete={(data) => { setInvoiceData(data); setStep(2) }} />
              </motion.div>
            )}
            {step === 2 && invoiceData && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step2Results data={invoiceData} onContinue={() => setStep(3)} />
              </motion.div>
            )}
            {step === 3 && invoiceData && (
              <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <Step3Form invoiceData={invoiceData} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
      <Footer />
      <Toaster />
    </>
  )
}
