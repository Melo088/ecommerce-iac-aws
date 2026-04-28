import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { LayoutGroup, motion } from 'framer-motion'
import { useUI } from '../context/UIContext'
import { getProducts } from '../services/productService'
import { getImageUrl } from '../utils/imageUtils'

function ProductCard({ product }) {
  const [imgError, setImgError] = useState(false)

  return (
    <Link to={`/product/${product.id}`} className="block group cursor-pointer">
      {/* image — no bottom padding so name sits ≤ 8px below */}
      <div className="aspect-[4/5] flex items-center justify-center px-6 pt-6 pb-0 overflow-hidden">
        {imgError ? (
          <div className="w-full h-full bg-[#f0f0f0]" />
        ) : (
          <motion.img
            layoutId={`product-image-${product.id}`}
            src={getImageUrl(product.id)}
            alt={product.name}
            onError={() => setImgError(true)}
            className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
          />
        )}
      </div>
      {/* name — mt-2 = 8px from image container bottom */}
      <p className="text-sm tracking-widest text-center mt-2 pb-4 text-black">
        {product.name}
      </p>
    </Link>
  )
}

export default function Home() {
  const { categoryName } = useParams()
  const { gridDense } = useUI()
  const [products, setProducts] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    getProducts(categoryName)
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setLoading(false))
  }, [categoryName])

  if (loading) {
    return (
      <main className="pt-28 min-h-screen flex items-center justify-center">
        <span className="text-sm tracking-widest text-gray-300">LOADING</span>
      </main>
    )
  }

  return (
    <main className="pt-28">
      <LayoutGroup>
        <div className={`grid transition-none ${gridDense ? 'grid-cols-6' : 'grid-cols-3'}`}>
          {products.map(product => (
            <motion.div
              key={product.id}
              layout
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <ProductCard product={product} />
            </motion.div>
          ))}
        </div>
      </LayoutGroup>

      {products.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <span className="text-sm tracking-widest text-gray-300">NO PRODUCTS</span>
        </div>
      )}
    </main>
  )
}
