import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function PaymentSuccess() {
  const { reset } = useCart()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const paymentId = params.get('payment_id')

  useEffect(() => {
    reset()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="pt-28 min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 text-center max-w-md w-full">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-black flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Pago aprobado</h1>
          <p className="text-sm text-gray-500 tracking-wide">Tu orden ha sido confirmada</p>
        </div>

        {/* Payment ID */}
        {paymentId && (
          <div className="w-full border border-gray-200 rounded-lg px-6 py-4 flex justify-between items-center">
            <span className="text-xs tracking-widest text-gray-400 uppercase">ID de pago</span>
            <span className="text-sm font-mono text-gray-700">{paymentId}</span>
          </div>
        )}

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <button
            onClick={() => navigate('/')}
            className="w-full bg-black text-white py-3.5 text-sm tracking-widest uppercase hover:bg-gray-800 transition-colors rounded-lg"
          >
            Seguir comprando
          </button>
          <button
            onClick={() => navigate('/profile')}
            className="w-full border border-gray-300 text-gray-700 py-3.5 text-sm tracking-widest uppercase hover:border-black hover:text-black transition-colors rounded-lg"
          >
            Ver mis pedidos
          </button>
        </div>

      </div>
    </main>
  )
}
