import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import api from '../api/axios'

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY)

const WALLET_CUSTOMIZATION = {
  visual: {
    buttonBackground: 'black',
    borderRadius: '0px',
    valuePropColor: 'white',
    verticalPadding: '16px',
    horizontalPadding: '0px',
  },
  texts: {
    action: 'buy',
    valueProp: 'smart_option',
  },
}

export default function Cart() {
  const { auth } = useAuth()
  const { items, cartLoading, increaseQty, decreaseQty, removeItem } = useCart()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [preferenceId, setPreferenceId] = useState(null)

  useEffect(() => {
    if (!auth) navigate('/login')
  }, [auth, navigate])

  async function handleProceedToPay() {
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/payments/create')
      setPreferenceId(data.preferenceId)
    } catch {
      /* silently fail */
    } finally {
      setLoading(false)
    }
  }

  const subtotal = items.reduce((s, i) => s + (Number(i.price) || 0) * i.quantity, 0)

  if (cartLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="text-sm tracking-widest text-black">LOADING</span>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="text-sm tracking-widest text-black">EMPTY</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-16 pt-24 pb-12">
      <div className="w-full max-w-6xl grid grid-cols-2 gap-24">

        {/* LEFT — Items */}
        <div>
          {items.map(item => {
            const lineTotal = (Number(item.price) || 0) * item.quantity
            return (
              <div key={item.id} className="flex items-center justify-between border-b border-gray-100 py-6 gap-5">
                <img
                  src={`/products/${item.productId}/main.png`}
                  alt={item.productName}
                  className="w-20 h-20 object-contain bg-gray-50 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm tracking-widest uppercase truncate">{item.productName}</p>
                  <div className="flex items-center gap-4 mt-3">
                    <button
                      onClick={() => decreaseQty(item)}
                      className="text-sm tracking-widest text-gray-400 hover:text-black transition-colors"
                    >
                      −
                    </button>
                    <span className="text-sm tracking-widest">{item.quantity}</span>
                    <button
                      onClick={() => increaseQty(item)}
                      className="text-sm tracking-widest text-gray-400 hover:text-black transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-sm tracking-widest">${lineTotal.toFixed(2)}</span>
                  <button
                    onClick={() => removeItem(item)}
                    className="text-xs tracking-widest text-gray-300 hover:text-black transition-colors uppercase"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* RIGHT — Summary + action */}
        <div className="flex flex-col justify-between">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between">
              <span className="text-sm tracking-widest uppercase text-gray-400">Subtotal</span>
              <span className="text-sm tracking-widest">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between pt-5 mt-2 border-t border-gray-200">
              <span className="text-sm tracking-widest uppercase">Total</span>
              <span className="text-sm tracking-widest">${subtotal.toFixed(2)}</span>
            </div>
          </div>

          <div className="mt-10">
            {preferenceId ? (
              <Wallet
                initialization={{ preferenceId }}
                customization={WALLET_CUSTOMIZATION}
              />
            ) : (
              <button
                onClick={handleProceedToPay}
                disabled={loading}
                className="w-full bg-black text-white py-5 text-sm tracking-widest uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
              >
                {loading ? '...' : 'Place Order'}
              </button>
            )}
          </div>
        </div>

      </div>
    </main>
  )
}
