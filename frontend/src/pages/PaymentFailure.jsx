import { Link } from 'react-router-dom'

export default function PaymentFailure() {
  return (
    <main className="pt-28 min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-8 text-center max-w-md w-full">

        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-50 border border-red-200 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        {/* Title */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Pago rechazado</h1>
          <p className="text-sm text-gray-500 tracking-wide">No pudimos procesar tu pago. Intentá de nuevo.</p>
        </div>

        {/* Buttons */}
        <div className="flex flex-col gap-3 w-full mt-2">
          <Link
            to="/cart"
            className="w-full bg-black text-white py-3.5 text-sm tracking-widest uppercase hover:bg-gray-800 transition-colors rounded-lg text-center"
          >
            Intentar de nuevo
          </Link>
          <Link
            to="/"
            className="w-full border border-gray-300 text-gray-700 py-3.5 text-sm tracking-widest uppercase hover:border-black hover:text-black transition-colors rounded-lg text-center"
          >
            Volver al inicio
          </Link>
        </div>

      </div>
    </main>
  )
}
