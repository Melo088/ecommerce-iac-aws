import { useEffect, useState } from 'react'
import api from '../api/axios'

export default function Home() {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [added, setAdded] = useState({})

  useEffect(() => {
    api.get('/api/v1/products')
      .then((res) => setProducts(res.data))
      .catch(() => setError('No se pudieron cargar los productos.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleAddToCart(productId) {
    try {
      await api.post('/api/v1/cart', { productId, quantity: 1 })
      setAdded((prev) => ({ ...prev, [productId]: true }))
      setTimeout(() => setAdded((prev) => ({ ...prev, [productId]: false })), 1500)
    } catch {
      alert('Inicia sesión para agregar al carrito.')
    }
  }

  if (loading) return <p className="text-center mt-12 text-gray-500">Cargando productos...</p>
  if (error)   return <p className="text-center mt-12 text-red-500">{error}</p>

  return (
    <main className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Catálogo de Productos</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.map((product) => (
          <div
            key={product.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow flex flex-col"
          >
            {product.imageUrl && (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-48 object-cover rounded-t-xl"
              />
            )}
            <div className="p-4 flex flex-col flex-1">
              <h2 className="text-gray-800 font-semibold text-base mb-1 line-clamp-2">
                {product.name}
              </h2>
              <p className="text-indigo-600 font-bold text-lg mt-auto mb-4">
                ${Number(product.price).toFixed(2)}
              </p>
              <button
                onClick={() => handleAddToCart(product.id)}
                className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                  added[product.id]
                    ? 'bg-green-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {added[product.id] ? 'Agregado' : 'Agregar al carrito'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </main>
  )
}
