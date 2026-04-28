import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login } from '../services/authService'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false) // Estado para el toggle
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const { login: storeLogin } = useAuth()
  const navigate = useNavigate()

  function handleChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data = await login(form.email, form.password)
      storeLogin({ token: data.token, userId: data.userId, name: data.name })
      navigate('/')
    } catch (err) {
      setError(err.response?.data?.message || 'INVALID CREDENTIALS')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pt-32 min-h-screen flex items-center justify-center px-6 bg-white font-mono">
      <div className="w-full max-w-sm"> {/* Aumentado de xs a sm */}
        <p className="text-xs tracking-[0.2em] mb-12 text-center text-black">LOGIN</p>

        {error && (
          <p className="text-[10px] tracking-widest text-center mb-8 text-black">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          <div className="border-b border-black pb-2">
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              placeholder="EMAIL"
              className="w-full text-xs tracking-widest bg-transparent outline-none placeholder:text-gray-300 uppercase"
            />
          </div>

          <div className="border-b border-black pb-2 relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              placeholder="PASSWORD"
              className="w-full text-xs tracking-widest bg-transparent outline-none placeholder:text-gray-300 uppercase"
            />
            {/* Botón de texto para mantener el estilo minimalista */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-0 text-[9px] tracking-tighter text-gray-400 hover:text-black transition-colors"
            >
              {showPassword ? 'HIDE' : 'SHOW'}
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="text-xs tracking-[0.3em] mt-6 hover:opacity-30 transition-opacity text-center disabled:opacity-30 border border-black py-4"
          >
            {loading ? '...' : 'ENTER'}
          </button>
        </form>

        <div className="flex justify-center mt-12">
          <Link to="/register" className="text-[10px] tracking-widest text-gray-400 hover:text-black transition-colors">
            CREATE ACCOUNT
          </Link>
        </div>
      </div>
    </main>
  )
}