import { useLocation, Link } from 'react-router-dom'

export default function Checkout() {
  const { state } = useLocation()

  if (!state?.orderId) {
    return (
      <main className="pt-28 min-h-screen flex items-center justify-center">
        <Link to="/" className="text-[10px] tracking-widest text-gray-300 hover:text-black transition-colors">
          RETURN
        </Link>
      </main>
    )
  }

  return (
    <main className="pt-28 min-h-screen flex items-center justify-center px-6">
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-[10px] tracking-widest">ORDER CONFIRMED</p>

        <div className="flex flex-col items-center gap-2 mt-4">
          <div className="flex gap-8">
            <span className="text-[9px] tracking-widest text-gray-300">ORDER</span>
            <span className="text-[9px] tracking-widest">{state.orderId}</span>
          </div>
          <div className="flex gap-8">
            <span className="text-[9px] tracking-widest text-gray-300">TOTAL</span>
            <span className="text-[9px] tracking-widest">${Number(state.total).toFixed(2)}</span>
          </div>
        </div>

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
