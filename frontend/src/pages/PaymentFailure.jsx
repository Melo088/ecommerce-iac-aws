import { Link } from 'react-router-dom'

export default function PaymentFailure() {
  return (
    <main className="pt-28 min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-[10px] tracking-widest">PAYMENT FAILED</p>

        <div className="flex flex-col gap-4 mt-4">
          <Link
            to="/cart"
            className="text-[10px] tracking-widest text-black hover:opacity-50 transition-opacity"
          >
            TRY AGAIN
          </Link>
          <Link
            to="/"
            className="text-[10px] tracking-widest text-gray-300 hover:text-black transition-colors"
          >
            RETURN
          </Link>
        </div>
      </div>
    </main>
  )
}
