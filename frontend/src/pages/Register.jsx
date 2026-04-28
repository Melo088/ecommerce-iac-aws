import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../services/authService'

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  function handleChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await register(form.name, form.email, form.password)
      navigate('/login')
    } catch (err) {
      setError(err.response?.data?.message || 'REGISTRATION FAILED')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="pt-32 min-h-screen flex items-center justify-center px-6 bg-white font-mono">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.2em] mb-12 text-center text-black">CREATE ACCOUNT</p>

        {error && (
          <p className="text-[10px] tracking-widest text-center mb-8 text-black">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-8">
          {/* Campo NAME */}
          <div className="border-b border-black pb-2">
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              placeholder="NAME"
              className="w-full text-xs tracking-widest bg-transparent outline-none placeholder:text-gray-300 uppercase"
            />
          </div>

          {/* Campo EMAIL */}
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

          {/* Campo PASSWORD con Toggle */}
          <div className="border-b border-black pb-2 relative flex items-center">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              value={form.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="PASSWORD"
              className="w-full text-xs tracking-widest bg-transparent outline-none placeholder:text-gray-300 uppercase"
            />
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
            {loading ? '...' : 'REGISTER'}
          </button>
        </form>

        <div className="flex justify-center mt-12">
          <Link to="/login" className="text-[10px] tracking-widest text-gray-400 hover:text-black transition-colors">
            ALREADY HAVE AN ACCOUNT
          </Link>
        </div>
      </div>
    </main>
  )
}