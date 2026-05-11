import { useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function PaymentSuccess() {
  const { reset } = useCart()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const paymentId = params.get('payment_id')

  // Deps vacíos: se ejecuta una sola vez al montar. No incluir `reset` porque
  // CartContext lo recrea en cada render (no está en useCallback), lo que
  // causaría un loop infinito: reset() → setItems([]) → re-render → nueva
  // referencia reset → efecto dispara de nuevo → ∞
  useEffect(() => {
    reset()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleContinue() {
    navigate('/')
  }

  return (
    <main className="pt-28 min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-[10px] tracking-widest">ORDER CONFIRMED</p>

        {paymentId && (
          <div className="flex gap-8 mt-4">
            <span className="text-[9px] tracking-widest text-gray-300">PAYMENT</span>
            <span className="text-[9px] tracking-widest">{paymentId}</span>
          </div>
        )}

        <button
          onClick={handleContinue}
          className="text-[10px] tracking-widest mt-8 text-gray-300 hover:text-black transition-colors"
        >
          CONTINUE
        </button>
      </div>
    </main>
  )
}
