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
  const categoryMatch  = useMatch('/category/:cat')
  const activeCategory = categoryMatch?.params?.cat ?? null

  const [categories, setCategories] = useState([])

  useEffect(() => {
    getCategories().then(setCategories).catch(() => {})
  }, [])

  function handleLeftClick() {
    if (isProductPage || isCartPage) navigate(-1)
    else toggleGrid()
  }

  return (
    <header className="fixed top-0 inset-x-0 z-50 bg-white">
      <div className="h-[2px] bg-black" />

      {/* Volvemos a los valores originales que te gustaban */}
      <div className="flex items-end justify-between px-10 pt-10 pb-6">

        {/* LEFT */}
        <button
          onClick={handleLeftClick}
          className="text-2xl tracking-widest py-2 px-2 shrink-0 hover:opacity-40 transition-opacity"
        >
          {(isProductPage || isCartPage) ? '<' : gridDense ? '+' : '<'}
        </button>

        {/* CENTER */}
        <div className="flex justify-center">
          {!isProductPage ? (
            <nav className="flex flex-wrap justify-center gap-8 text-sm tracking-widest uppercase">
              <Link
                to="/"
                className={`transition-colors ${!activeCategory ? 'text-black' : 'text-gray-300'}`}
              >
                ALL
              </Link>
              {categories.map(cat => (
                <Link
                  key={cat}
                  to={`/category/${cat}`}
                  className={`transition-colors ${activeCategory === cat ? 'text-black' : 'text-gray-300'}`}
                >
                  {cat}
                </Link>
              ))}
              {auth ? (
                <button
                  onClick={() => { logout(); navigate('/') }}
                  className="text-gray-300 hover:text-black transition-colors"
                >
                  LOGOUT
                </button>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:text-black transition-colors">LOGIN</Link>
                  <Link to="/register" className="text-gray-300 hover:text-black transition-colors">REGISTER</Link>
                </>
              )}
            </nav>
          ) : null}
        </div>

        {/* RIGHT */}
        <div className="flex justify-end">
          <button
            onClick={() => navigate('/cart')}
            className="flex items-center gap-3 text-base p-2 hover:opacity-40 transition-opacity"
          >
            {count > 0 && <span className="tracking-widest">{count}</span>}
            <ShoppingBag size={20} strokeWidth={1.25} />
          </button>
        </div>

      </div>
    </header>
  )
}