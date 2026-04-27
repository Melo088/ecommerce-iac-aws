import { useLocation, Link } from 'react-router-dom'

export default function Checkout() {
  const { state } = useLocation()

  if (!state?.orderId) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">No hay información de pedido.</p>
          <Link to="/" className="text-indigo-600 hover:underline">Volver al catálogo</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="bg-white rounded-xl shadow-md border border-gray-200 w-full max-w-md p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mx-auto mb-4">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">Pago confirmado</h1>
        <p className="text-gray-500 text-sm mb-6">Gracias por tu compra.</p>

        <div className="bg-gray-50 rounded-lg p-4 text-left mb-6">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-500">Orden ID</span>
            <span className="font-mono font-semibold text-gray-800">{state.orderId}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total pagado</span>
            <span className="font-bold text-indigo-600">${Number(state.total).toFixed(2)}</span>
          </div>
        </div>

        <Link
          to="/"
          className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-2.5 rounded-lg transition-colors"
        >
          Seguir comprando
        </Link>
      </div>
    </main>
  )
}
