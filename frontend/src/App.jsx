import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import { CartProvider } from './context/CartContext'
import Header from './components/Header'
import Home from './pages/Home'
import ProductDetail from './pages/ProductDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'

// 1. Creamos este subcomponente para poder acceder a useLocation()
function AnimatedRoutes() {
  const location = useLocation()

  return (
    // 2. AnimatePresence mantiene viva la página anterior hasta que la animación termina
    <AnimatePresence mode="wait">
      {/* 3. Le pasamos el location y un key para que React sepa cuándo hay un cambio real de página */}
      <Routes location={location} key={location.pathname}>
        <Route path="/"                      element={<Home />} />
        <Route path="/category/:categoryName" element={<Home />} />
        <Route path="/product/:id"           element={<ProductDetail />} />
        <Route path="/login"                 element={<Login />} />
        <Route path="/register"              element={<Register />} />
        <Route path="/cart"                  element={<Cart />} />
        <Route path="/checkout"              element={<Checkout />} />
      </Routes>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <CartProvider>
            <Header />
            {/* rutas animadas aquí */}
            <AnimatedRoutes />
          </CartProvider>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}