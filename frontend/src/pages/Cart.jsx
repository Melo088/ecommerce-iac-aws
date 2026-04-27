import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import { useAuth } from '../context/AuthContext'

export default function Cart() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const { auth } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!auth) { navigate('/login'); return }
    api.get('/api/v1/cart')
      .then((res) => setItems(res.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [auth, navigate])

  async function handleRemove(productId) {
    await api.delete(`/api/v1/cart/${productId}`)
    setItems((prev) => prev.filter((i) => i.productId !== productId))
  }

  async function handleCheckout() {
    setPaying(true)
    try {
      const { data } = await api.post('/api/v1/checkout')
      navigate('/checkout', { state: { orderId: data.orderId, total: data.total } })
    } catch {
      alert('Error al procesar el pago.')
    } finally {
      setPaying(false)
    }
  }

  const total = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0)

  if (loading) return <p className="text-center mt-12 text-gray-500">Cargando carrito...</p>

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Carrito de compras</h1>

      {items.length === 0 ? (
        <p className="text-gray-500 text-center mt-12">Tu carrito está vacío.</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <div
                key={item.productId}
                className="bg-white border border-gray-200 rounded-xl px-5 py-4 flex items-center justify-between shadow-sm"
              >
                <div>
                  <p className="font-semibold text-gray-800">{item.productName}</p>
                  <p className="text-sm text-gray-500">
                    Cantidad: {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <p className="font-bold text-indigo-600">
                    ${(item.unitPrice * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => handleRemove(item.productId)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-2 py-1 rounded-md transition-colors"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 flex items-center justify-between border-t border-gray-200 pt-6">
            <p className="text-lg font-bold text-gray-800">
              Total: <span className="text-indigo-600">${total.toFixed(2)}</span>
            </p>
            <button
              onClick={handleCheckout}
              disabled={paying}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
            >
              {paying ? 'Procesando...' : 'Pagar'}
            </button>
          </div>
        </>
      )}
    </main>
  )
}
