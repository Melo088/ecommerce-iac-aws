import { useEffect } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCart } from '../context/CartContext'

export default function PaymentSuccess() {
  const { reset } = useCart()
  const [params] = useSearchParams()
  const paymentId = params.get('payment_id')

  useEffect(() => {
    reset()
  }, [reset])

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

        <Link
          to="/"
          className="text-[10px] tracking-widest mt-8 text-gray-300 hover:text-black transition-colors"
        >
          CONTINUE
        </Link>
      </div>
    </main>
  )
}
