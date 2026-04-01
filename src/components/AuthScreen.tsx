import { useState } from 'react'
import { supabase } from '@/supabase/client'
import { motion, AnimatePresence } from 'framer-motion'
import { Plane, LogIn, User, Lock, UserPlus, FileWarning } from 'lucide-react'

export default function AuthScreen() {
  const [username, setUsername] = useState('')
  const [pin, setPin] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const fakeEmail = `${username.trim().toLowerCase()}@appviajes.local`
      
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email: fakeEmail, password: pin })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email: fakeEmail, password: pin })
        if (error) throw error
        alert('Cuenta creada exitosamente. 🎉')
      }
    } catch (err: any) {
      setError(err.message || 'Error de autenticación')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[#0b1220] px-4 font-sans text-slate-50">
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] h-[50%] w-[50%] rounded-full bg-sky-900/20 blur-[120px]" />
        <div className="absolute bottom-[-20%] right-[-10%] h-[50%] w-[50%] rounded-full bg-emerald-900/20 blur-[120px]" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="z-10 w-full max-w-sm rounded-[2rem] border border-zinc-800/60 bg-zinc-950/60 p-8 shadow-2xl backdrop-blur-xl"
      >
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-sky-500/20 text-sky-400">
            <Plane className="h-8 w-8" strokeWidth={1.5} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
            {isLogin ? 'Bienvenido a Bordo' : 'Crear Cuenta'}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {isLogin ? 'Inicia sesión para proteger y sincronizar tus viajes' : 'Regístrate para guardar y sincronizar tus viajes en la nube'}
          </p>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6 overflow-hidden"
            >
              <div className="flex items-center gap-2 rounded-xl border border-rose-900/50 bg-rose-950/30 p-3 text-sm text-rose-400">
                <FileWarning className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <form onSubmit={handleAuth} className="space-y-4">
          <div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/\s+/g, ''))}
                placeholder="Nombre de usuario"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-sky-500/50 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all"
              />
            </div>
          </div>
          
          <div>
            <div className="relative">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-zinc-500">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                minLength={6}
                maxLength={6}
                inputMode="numeric"
                pattern="[0-9]*"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="PIN de 6 dígitos"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/50 py-3 pl-11 pr-4 text-sm text-zinc-100 placeholder-zinc-500 focus:border-sky-500/50 focus:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-sky-500/50 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-500 py-3 text-sm font-semibold text-slate-950 shadow-md shadow-sky-500/10 transition-all hover:bg-sky-400 active:scale-95 disabled:opacity-70 disabled:active:scale-100"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-800 border-t-transparent" />
            ) : isLogin ? (
              <>
                <LogIn className="h-4 w-4" />
                Ingresar
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Registrarse
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-500">
          {isLogin ? '¿No tienes una cuenta?' : '¿Ya tienes una cuenta?'}
          <button
            type="button"
            onClick={() => {
              setIsLogin(!isLogin)
              setError(null)
            }}
            className="ml-1 font-medium text-sky-400 hover:text-sky-300 focus:outline-none"
          >
            {isLogin ? 'Crear una' : 'Iniciar sesión'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
