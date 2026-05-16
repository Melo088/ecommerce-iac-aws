import { useEffect, useState } from 'react'
import api from '../api/axios'
import { getImageUrl } from '../utils/imageUtils'

const STATUS_STYLES = {
  PAID:    'text-black',
  PENDING: 'text-gray-400',
  FAILED:  'text-red-500',
}

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).toUpperCase()
}

export default function Profile() {
  const [user, setUser]         = useState(null)
  const [orders, setOrders]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    Promise.all([
      api.get('/api/v1/users/me'),
      api.get('/api/v1/orders/my'),
    ]).then(([uRes, oRes]) => {
      setUser(uRes.data)
      setOrders(oRes.data)
    }).finally(() => setLoading(false))
  }, [])

  function toggle(id) {
    setExpanded(prev => (prev === id ? null : id))
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <span className="text-sm tracking-widest">LOADING</span>
      </main>
    )
  }

  return (
    <main className="min-h-screen px-6 pt-20 pb-10 md:px-16 md:pt-24 md:pb-16">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-24">

        {/* LEFT — Profile summary */}
        <div>
          <p className="text-sm tracking-widest uppercase mb-8 md:mb-10">Profile</p>

          <div className="flex flex-col gap-6 md:gap-8">
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-2">Name</p>
              <p className="text-sm tracking-widest uppercase">{user?.name || '—'}</p>
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-2">Email</p>
              <p className="text-sm tracking-widest break-all">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs tracking-widest uppercase text-gray-400 mb-2">Member Since</p>
              <p className="text-sm tracking-widest">{formatDate(user?.createdAt)}</p>
            </div>
          </div>
        </div>

        {/* RIGHT — Order history */}
        <div>
          <p className="text-sm tracking-widest uppercase mb-8 md:mb-10">Order History</p>

          {orders.length === 0 ? (
            <p className="text-sm tracking-widest text-gray-400 uppercase">No orders yet</p>
          ) : (
            <div className="flex flex-col gap-4 md:gap-5">
              {orders.map(order => {
                const isOpen = expanded === order.id
                const thumb  = order.items[0] ? getImageUrl(order.items[0].productId) : null

                return (
                  <div
                    key={order.id}
                    className="border border-gray-100 cursor-pointer"
                    onClick={() => toggle(order.id)}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-4 p-4 md:gap-5 md:p-5">
                      {thumb && (
                        <img
                          src={thumb}
                          alt=""
                          className="w-14 h-14 md:w-16 md:h-16 object-contain bg-gray-50 shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm tracking-widest uppercase">#{order.shortId}</p>
                          <p className={`text-xs tracking-widest uppercase shrink-0 ${STATUS_STYLES[order.status] ?? 'text-gray-400'}`}>
                            {order.status}
                          </p>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-2">
                          <p className="text-xs tracking-widest text-gray-400">{formatDate(order.createdAt)}</p>
                          <p className="text-sm tracking-widest shrink-0">${Number(order.total).toFixed(2)}</p>
                        </div>
                      </div>
                    </div>

                    {/* Expanded item list */}
                    {isOpen && order.items.length > 0 && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 md:px-5 md:pb-5 md:pt-4 flex flex-col gap-3 md:gap-4">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 md:gap-4">
                            <img
                              src={getImageUrl(item.productId)}
                              alt={item.productName}
                              className="w-12 h-12 md:w-14 md:h-14 object-contain bg-gray-50 shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs tracking-widest uppercase truncate">{item.productName}</p>
                              <p className="text-xs tracking-widest text-gray-400 mt-1">
                                {item.quantity} × ${Number(item.price).toFixed(2)}
                              </p>
                            </div>
                            <p className="text-xs tracking-widest shrink-0">
                              ${(item.quantity * Number(item.price)).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

      </div>
    </main>
  )
}
