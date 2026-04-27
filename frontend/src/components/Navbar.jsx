import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function Navbar() {
  const { auth, logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between shadow-sm">
      <Link to="/" className="text-xl font-bold text-indigo-600">
        EcomStore
      </Link>

      <div className="flex items-center gap-4">
        {auth ? (
          <>
            <span className="text-gray-600 text-sm">Hola, {auth.name}</span>
            <Link
              to="/cart"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Carrito
            </Link>
            <button
              onClick={handleLogout}
              className="text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-md transition-colors"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link
              to="/login"
              className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-md transition-colors"
            >
              Registro
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
