'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Loader2, Eye, EyeOff } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSupabaseClient } from '@/lib/supabase'
import { Toaster } from '@/components/ui/toaster'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const supabase = getSupabaseClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      router.push('/dashboard')
    }
  }

  return (
    <>
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
        {/* Background grid */}
        <div className="fixed inset-0 opacity-[0.02]" style={{
          backgroundImage: 'linear-gradient(#00E676 1px, transparent 1px), linear-gradient(90deg, #00E676 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-sm"
        >
          {/* Logo */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#00E676] flex items-center justify-center shadow-[0_0_20px_rgba(0,230,118,0.3)]">
                <Zap className="w-5 h-5 text-black fill-black" />
              </div>
              <span className="font-bold text-xl">Energ<span className="text-[#00E676]">IA</span></span>
            </Link>
            <h1 className="text-2xl font-bold text-white">Accede al panel</h1>
            <p className="text-[#9CA3AF] mt-2 text-sm">Gestiona tus clientes y facturas</p>
          </div>

          {/* Form */}
          <div className="bg-[#141414] border border-[#1F1F1F] rounded-2xl p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Email</label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  autoComplete="email"
                />
              </div>

              {/* Password */}
              <div>
                <label className="block text-sm text-[#9CA3AF] mb-1.5">Contraseña</label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-white transition-colors"
                  >
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Error */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                disabled={loading}
                className="w-full gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Iniciar sesión
              </Button>
            </form>
          </div>

          {/* Footer */}
          <p className="text-center text-[#6B7280] text-xs mt-6">
            <Link href="/" className="hover:text-white transition-colors">
              ← Volver al inicio
            </Link>
          </p>
        </motion.div>
      </div>
      <Toaster />
    </>
  )
}
