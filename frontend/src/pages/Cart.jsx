import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { initMercadoPago, Wallet } from '@mercadopago/sdk-react'
import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import api from '../api/axios'

initMercadoPago(import.meta.env.VITE_MP_PUBLIC_KEY)

const LABEL = 'text-xs tracking-widest uppercase mb-1 block'
const INPUT = 'border border-black w-full p-3 bg-white outline-none text-xs tracking-widest rounded-none'

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
  const [form, setForm] = useState({
    email: '', firstName: '', lastName: '',
    address: '', city: '', country: 'COLOMBIA',
    state: '', zip: '', phone: '',
  })

  useEffect(() => {
    if (!auth) navigate('/login')
  }, [auth, navigate])

  function handleField(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

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
        <span className="text-xs tracking-widest text-gray-300">LOADING</span>
      </main>
    )
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="text-xs tracking-widest text-gray-300">EMPTY</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-16 pt-24 pb-12">
      <div className="w-full max-w-6xl grid grid-cols-2 gap-24">

        {/* LEFT — Checkout form */}
        <div>
          <div className="mb-4">
            <label className={LABEL}>Email Address</label>
            <input name="email" type="email" value={form.email} onChange={handleField} className={INPUT} />
          </div>

          <p className="text-xs tracking-widest uppercase mb-4 mt-6">Shipping Address</p>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={LABEL}>First Name</label>
              <input name="firstName" value={form.firstName} onChange={handleField} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Last Name</label>
              <input name="lastName" value={form.lastName} onChange={handleField} className={INPUT} />
            </div>
          </div>

          <div className="mb-4">
            <label className={LABEL}>Address</label>
            <input name="address" value={form.address} onChange={handleField} className={INPUT} />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={LABEL}>City</label>
              <input name="city" value={form.city} onChange={handleField} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Country</label>
              <input name="country" value={form.country} onChange={handleField} className={INPUT} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className={LABEL}>State / Province</label>
              <input name="state" value={form.state} onChange={handleField} className={INPUT} />
            </div>
            <div>
              <label className={LABEL}>Zip Code</label>
              <input name="zip" value={form.zip} onChange={handleField} className={INPUT} />
            </div>
          </div>

          <div className="mb-4">
            <label className={LABEL}>Phone Number</label>
            <input name="phone" value={form.phone} onChange={handleField} className={INPUT} />
          </div>

          <div className="mt-8">
            {preferenceId ? (
              <Wallet
                initialization={{ preferenceId }}
                customization={WALLET_CUSTOMIZATION}
              />
            ) : (
              <button
                onClick={handleProceedToPay}
                disabled={loading}
                className="w-full bg-black text-white py-4 text-xs tracking-widest uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
              >
                {loading ? '...' : 'Place Order'}
              </button>
            )}
          </div>
        </div>

        {/* RIGHT — Order summary */}
        <div>
          {items.map(item => {
            const lineTotal = (Number(item.price) || 0) * item.quantity
            return (
              <div key={item.id} className="flex items-center justify-between border-b border-gray-100 py-4 gap-4">
                <img
                  src={`/products/${item.productId}/main.png`}
                  alt={item.productName}
                  className="w-16 h-16 object-contain bg-gray-50 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs tracking-widest uppercase truncate">{item.productName}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <button
                      onClick={() => decreaseQty(item)}
                      className="text-xs tracking-widest text-gray-400 hover:text-black transition-colors"
                    >
                      −
                    </button>
                    <span className="text-xs tracking-widest">{item.quantity}</span>
                    <button
                      onClick={() => increaseQty(item)}
                      className="text-xs tracking-widest text-gray-400 hover:text-black transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-xs tracking-widest">${lineTotal.toFixed(2)}</span>
                  <button
                    onClick={() => removeItem(item)}
                    className="text-[10px] tracking-widest text-gray-300 hover:text-black transition-colors uppercase"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )
          })}

          <div className="mt-6 flex flex-col gap-3">
            <div className="flex justify-between">
              <span className="text-xs tracking-widest uppercase text-gray-400">Subtotal</span>
              <span className="text-xs tracking-widest">${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs tracking-widest uppercase text-gray-400">Shipping</span>
              <span className="text-xs tracking-widest text-gray-400">Calculated at next step</span>
            </div>
            <div className="flex justify-between">
              <span className="text-xs tracking-widest uppercase text-gray-400">Taxes</span>
              <span className="text-xs tracking-widest">$0.00</span>
            </div>
            <div className="flex justify-between pt-4 mt-2 border-t border-gray-200">
              <span className="text-xs tracking-widest uppercase">Total</span>
              <span className="text-xs tracking-widest">${subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

      </div>
    </main>
  )
}
