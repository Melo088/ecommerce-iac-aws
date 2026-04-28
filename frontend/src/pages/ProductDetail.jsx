import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getProduct } from '../services/productService'
import { getImageUrl } from '../utils/imageUtils'
import { useCart } from '../context/CartContext'
import { useAuth } from '../context/AuthContext'

const MAX_GALLERY = 4

const slideVariants = {
  enter: dir => ({ x: dir > 0 ? '60%' : '-60%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  dir => ({ x: dir < 0 ? '60%' : '-60%', opacity: 0 }),
}

function probeImage(url) {
  return new Promise(resolve => {
    const img = new window.Image()
    img.onload  = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

export default function ProductDetail() {
  const { id }        = useParams()
  const navigate      = useNavigate()
  const { auth }      = useAuth()
  const { addToCart } = useCart()

  const [product,   setProduct]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [images,    setImages]    = useState(null)   // null = probing
  const [slide,     setSlide]     = useState([0, 0])
  const [imgErrors, setImgErrors] = useState({})
  const [showInfo,  setShowInfo]  = useState(false)
  const [isAdding,  setIsAdding]  = useState(false)

  const [current, direction] = slide

  useEffect(() => {
    getProduct(id)
      .then(setProduct)
      .catch(() => navigate('/'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  useEffect(() => {
    if (!product) return
    let cancelled = false

    async function probe() {
      const urls = [getImageUrl(product.id, 'main')]
      for (let i = 1; i <= MAX_GALLERY; i++) {
        if (cancelled) return
        const ok = await probeImage(getImageUrl(product.id, i))
        if (!ok) break
        urls.push(getImageUrl(product.id, i))
      }
      if (!cancelled) { setImages(urls); setSlide([0, 0]) }
    }

    probe()
    return () => { cancelled = true }
  }, [product])

  function paginate(dir) {
    if (!images || images.length <= 1) return
    setSlide(([cur]) => [(cur + dir + images.length) % images.length, dir])
  }

  async function handleAddToCart() {
    if (!auth) { navigate('/login'); return }
    setIsAdding(true)
    try { await addToCart(Number(id)) }
    catch { /* silently fail */ }
    finally { setTimeout(() => setIsAdding(false), 1500) }
  }

  if (loading || !product) {
    return (
      <main className="pt-28 min-h-screen flex items-center justify-center">
        <span className="text-sm tracking-widest text-gray-300">LOADING</span>
      </main>
    )
  }

  const descLines  = product.description
    ? product.description.split('/').map(l => l.trim()).filter(Boolean)
    : []
  const hasMultiple = images && images.length > 1

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="pt-28"
    >
      {/* ── Carousel Container ── */}
      {/* El contenedor principal ocupa todo el ancho y centra su contenido */}
      <div className="relative flex items-center justify-center h-[55vh] w-full mt-4">
        
        {/* Este es el "ancla": un div del tamaño de la imagen que está perfectamente centrado */}
        <div className="relative w-full max-w-lg h-full flex items-center justify-center">
          
          {/* Flecha Izquierda: Absoluta respecto al cuadro central, movida hacia afuera */}
          {hasMultiple && (
            <button
              onClick={() => paginate(-1)}
              className="absolute -left-20 top-1/2 -translate-y-1/2 text-black hover:opacity-30 transition-opacity z-10"
              aria-label="Previous"
            >
              <ChevronLeft size={20} strokeWidth={3} />
            </button>
          )}

          {/* Contenedor de la imagen con la animación Hero */}
          <div className="w-full h-full flex items-center justify-center overflow-hidden">
            {images === null ? (
              <div className="w-64 h-64 bg-[#f0f0f0]" />
            ) : (
              <AnimatePresence initial={false} custom={direction}>
                <motion.div
                  key={current}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
                  className="absolute w-full h-full flex items-center justify-center"
                >
                  {imgErrors[current] ? (
                    <div className="w-64 h-64 bg-[#f0f0f0]" />
                  ) : (
                    <motion.img
                      layoutId={current === 0 ? `product-image-${product.id}` : undefined}
                      src={images[current]}
                      alt={`${product.name} ${current}`}
                      onError={() => setImgErrors(p => ({ ...p, [current]: true }))}
                      className="max-h-full max-w-full object-contain"
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            )}
          </div>

          {/* Flecha Derecha: Absoluta respecto al cuadro central, movida hacia afuera */}
          {hasMultiple && (
            <button
              onClick={() => paginate(1)}
              className="absolute -right-20 top-1/2 -translate-y-1/2 text-black hover:opacity-30 transition-opacity z-10"
              aria-label="Next"
            >
              <ChevronRight size={20} strokeWidth={3} />
            </button>
          )}
        </div>
      </div>

      {/* ── Dots — mt-4 below carousel ─────────────────────────────── */}
      {hasMultiple && (
        <div className="flex justify-center gap-2 mt-4">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={() => setSlide([i, i > current ? 1 : -1])}
              className={`w-1 h-1 rounded-full transition-colors ${
                i === current ? 'bg-black' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      )}

      {/* ── Product info — mt-4 below carousel/dots ────────────────── */}
      <div className="flex flex-col items-center gap-3 mt-4 pb-16 px-4">

        <div className="flex items-center gap-3">
          <span className="text-sm tracking-widest">{product.name}</span>
          {showInfo && (
            <button
              onClick={() => setShowInfo(false)}
              className="text-sm hover:opacity-50 transition-opacity"
            >
              ×
            </button>
          )}
        </div>

        <span className="text-sm tracking-widest">
          ${Number(product.price).toFixed(2)}
        </span>

        {!showInfo && (
          <>
            <button
              onClick={handleAddToCart}
              disabled={isAdding}
              className="relative h-6 min-w-[60px] text-sm tracking-widest hover:opacity-30 transition-opacity disabled:opacity-30 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {isAdding ? (
                  <motion.span
                    key="adding"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    ADDING
                  </motion.span>
                ) : (
                  <motion.span
                    key="plus"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 10, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    +
                  </motion.span>
                )}
              </AnimatePresence>
            </button>

            {descLines.length > 0 && (
              <button
                onClick={() => setShowInfo(true)}
                className="text-sm tracking-widest hover:opacity-30 transition-opacity"
              >
                INFORMATION
              </button>
            )}
          </>
        )}

        {showInfo && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-1 mt-1"
          >
            {descLines.map((line, i) => (
              <p key={i} className="text-sm tracking-widest text-center">
                {line}
              </p>
            ))}
          </motion.div>
        )}
      </div>
    </motion.main>
  )
}
