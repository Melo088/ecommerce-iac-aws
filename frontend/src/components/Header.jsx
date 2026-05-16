import { useEffect, useState } from 'react'
import { Link, useMatch, useNavigate } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import { useUI } from '../context/UIContext'
import { getCategories } from '../services/productService'

export default function Header() {
  const { auth, logout } = useAuth()
  const { count } = useCart()
  const { gridDense, toggleGrid } = useUI()
  const navigate = useNavigate()

  const isProductPage  = useMatch('/product/:id')
  const isCartPage     = useMatch('/cart')
  const isAdminPage    = useMatch('/admin')
  const categoryMatch  = useMatch('/category/:cat')
  const activeCategory = categoryMatch?.params?.cat ?? null

  const [categories, setCategories] = useState([])

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  function handleLeftClick() {
    if (isAdminPage) navigate('/')
    else if (isProductPage || isCartPage) navigate(-1)
    else toggleGrid()
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white">
      <div className="h-[2px] bg-black" />

      <div className="flex items-start justify-between px-4 pt-3 pb-2 md:px-10 md:pt-10 md:pb-6">

        {/* LEFT */}
        <button
          onClick={handleLeftClick}
          className="text-lg md:text-2xl tracking-widest py-1 px-1 md:py-2 md:px-2 shrink-0 hover:opacity-40 transition-opacity"
        >
          {(isProductPage || isCartPage || isAdminPage) ? '<' : gridDense ? '+' : '<'}
        </button>

        {/* spacer */}
        <div className="flex-1 min-w-6 md:min-w-14" />

        {/* CENTER */}
        {!isProductPage && (
          <nav className="flex flex-wrap justify-center gap-x-2 gap-y-0.5 md:gap-x-8 md:gap-y-2 text-[9px] md:text-sm tracking-widest uppercase">
            <Link
              to="/"
              className={`transition-colors ${!activeCategory ? 'text-black' : 'text-gray-300 hover:text-black'}`}
            >
              ALL
            </Link>
            {categories.map(cat => (
              <Link
                key={cat}
                to={`/category/${cat}`}
                className={`transition-colors ${activeCategory === cat ? 'text-black' : 'text-gray-300 hover:text-black'}`}
              >
                {cat}
              </Link>
            ))}
            <span className="text-gray-200 select-none">|</span>
            {auth ? (
              <>
                <Link to="/profile" className="text-gray-300 hover:text-black transition-colors">PROFILE</Link>
                {auth.role === 'ADMIN' && (
                  <Link to="/admin" className="text-gray-300 hover:text-black transition-colors">ADMIN</Link>
                )}
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="text-gray-300 hover:text-black transition-colors"
                >
                  LOGOUT
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-gray-300 hover:text-black transition-colors">LOGIN</Link>
                <Link to="/register" className="text-gray-300 hover:text-black transition-colors">REGISTER</Link>
              </>
            )}
          </nav>
        )}

        {/* spacer */}
        <div className="flex-1 min-w-6 md:min-w-14" />

        {/* RIGHT */}
        <button
          onClick={() => navigate('/cart')}
          className="flex items-center gap-2 p-1 md:gap-3 md:p-2 hover:opacity-40 transition-opacity shrink-0"
        >
          {count > 0 && <span className="text-[9px] md:text-base tracking-widest">{count}</span>}
          <ShoppingBag size={16} strokeWidth={1.25} className="md:hidden" />
          <ShoppingBag size={20} strokeWidth={1.25} className="hidden md:block" />
        </button>

      </div>
    </header>
  )
}
