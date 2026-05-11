import { useState, useEffect } from 'react'
import axios from 'axios'
import api from '../../api/axios'
import { getImageUrl } from '../../utils/imageUtils'

const CATEGORIES = ['ACCESSORIES', 'TOPS', 'BOTTOMS', 'FOOTWEAR', 'OUTERWEAR']
const EMPTY_FORM  = { name: '', description: '', category: 'ACCESSORIES', price: '', stock: '' }

const INPUT  = 'border border-black w-full py-6 px-5 bg-white outline-none text-xs tracking-widest uppercase rounded-none placeholder:text-gray-400'
const SELECT = 'border border-black w-full py-6 px-5 bg-white outline-none text-xs tracking-widest uppercase rounded-none appearance-none cursor-pointer'

export default function AdminDashboard() {
  const [products, setProducts]     = useState([])
  const [form, setForm]             = useState(EMPTY_FORM)
  const [stockEdits, setStockEdits] = useState({})
  const [mainImage, setMainImage]   = useState(null)
  const [gallery, setGallery]       = useState([null, null, null, null])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState(null)

  useEffect(() => {
    api.get('/api/v1/products').then(r => setProducts(r.data)).catch(() => {})
  }, [])

  function handleFormChange(e) {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }))
  }

  function handleGalleryChange(i, file) {
    setGallery(prev => { const n = [...prev]; n[i] = file; return n })
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data } = await api.post('/api/v1/products', {
        name:        form.name,
        description: form.description,
        category:    form.category,
        price:       parseFloat(form.price),
        stock:       parseInt(form.stock, 10),
      })

      const hasImages = mainImage || gallery.some(Boolean)
      if (hasImages) {
        const { data: urls } = await api.post(`/api/v1/admin/products/${data.id}/upload-urls`)
        const uploads = []
        if (mainImage && urls.main) {
          uploads.push(axios.put(urls.main, mainImage, { headers: { 'Content-Type': mainImage.type } }))
        }
        gallery.forEach((file, i) => {
          const key = `gallery_${i + 1}`
          if (file && urls[key]) {
            uploads.push(axios.put(urls[key], file, { headers: { 'Content-Type': file.type } }))
          }
        })
        await Promise.all(uploads)
      }

      setProducts(p => [...p, data])
      setForm(EMPTY_FORM)
      setMainImage(null)
      setGallery([null, null, null, null])
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear producto')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveStock(product) {
    const newStock = parseInt(stockEdits[product.id], 10)
    if (isNaN(newStock) || newStock === product.stock) return
    try {
      await api.put(`/api/v1/products/${product.id}`, { ...product, stock: newStock })
      setProducts(p => p.map(x => x.id === product.id ? { ...x, stock: newStock } : x))
      setStockEdits(p => { const n = { ...p }; delete n[product.id]; return n })
    } catch {
      setError('Error al actualizar stock')
    }
  }

  async function handleDelete(id) {
    try {
      await api.delete(`/api/v1/products/${id}`)
      setProducts(p => p.filter(x => x.id !== id))
    } catch {
      setError('Error al eliminar producto')
    }
  }

  return (
    <main className="min-h-screen flex justify-center px-16 pt-44 pb-24 font-mono">
      <div className="w-full max-w-4xl">

        {/* ── ADD PRODUCT ─────────────────────────────────────── */}
        <p className="text-sm tracking-widest uppercase mb-14">ADD PRODUCT</p>

        {error && (
          <p className="text-[10px] tracking-widest mb-10 text-black">{error}</p>
        )}

        <form onSubmit={handleCreate}>
          <div className="grid grid-cols-2 gap-20">

            {/* LEFT — campos */}
            <div className="flex flex-col gap-8">
              <input
                name="name"
                value={form.name}
                onChange={handleFormChange}
                placeholder="NAME"
                required
                className={INPUT}
              />
              <input
                name="description"
                value={form.description}
                onChange={handleFormChange}
                placeholder="DESCRIPTION"
                required
                className={INPUT}
              />
              <select
                name="category"
                value={form.category}
                onChange={handleFormChange}
                className={SELECT}
              >
                {CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-6">
                <input
                  name="price"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={handleFormChange}
                  placeholder="PRICE"
                  required
                  className={INPUT}
                />
                <input
                  name="stock"
                  type="number"
                  min="0"
                  step="1"
                  value={form.stock}
                  onChange={handleFormChange}
                  placeholder="STOCK"
                  required
                  className={INPUT}
                />
              </div>
            </div>

            {/* RIGHT — imágenes */}
            <div className="flex flex-col gap-8">
              <p className="text-[10px] tracking-widest uppercase text-black">IMAGES</p>

              {/* Main image */}
              <div className="flex flex-col gap-2">
                <p className="text-[10px] tracking-widest text-black">MAIN IMAGE</p>
                <label className="border border-black flex items-center justify-between py-6 px-5 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="text-xs tracking-widest text-gray-300 uppercase truncate pr-4">
                    {mainImage ? mainImage.name : 'SELECT FILE'}
                  </span>
                  <span className="text-[10px] tracking-widest text-gray-300 shrink-0">BROWSE</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => setMainImage(e.target.files[0] ?? null)}
                  />
                </label>
                <p className="text-[9px] tracking-widest text-gray-300">
                  S3: products/&#123;id&#125;/main.png
                </p>
              </div>

              {/* Gallery */}
              <div className="flex flex-col gap-6">
                <p className="text-[10px] tracking-widest text-black">GALLERY</p>
                {gallery.map((file, i) => (
                  <div key={i} className="flex flex-col gap-2">
                    <label className="border border-black flex items-center justify-between py-6 px-5 cursor-pointer hover:bg-gray-50 transition-colors">
                      <span className="text-xs tracking-widest text-gray-300 uppercase truncate pr-4">
                        {file ? file.name : `GALLERY ${i + 1}`}
                      </span>
                      <span className="text-[10px] tracking-widest text-gray-300 shrink-0">BROWSE</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={e => handleGalleryChange(i, e.target.files[0] ?? null)}
                      />
                    </label>
                    {file && (
                      <p className="text-[9px] tracking-widest text-gray-300">
                        S3: products/&#123;id&#125;/gallery/{i + 1}.png
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-20 w-full bg-black text-white py-6 text-xs tracking-widest uppercase hover:opacity-70 transition-opacity disabled:opacity-30"
          >
            {loading ? '...' : 'ADD PRODUCT'}
          </button>
        </form>

        {/* ── SEPARATOR ───────────────────────────────────────── */}
        <div className="mt-28 mb-14 flex items-center gap-8">
          <p className="text-sm tracking-widest uppercase text-black shrink-0">
            EXISTING PRODUCTS
          </p>
          <hr className="flex-1 border-gray-300" />
        </div>

        {/* ── PRODUCT LIST ────────────────────────────────────── */}
        <div className="flex flex-col">
          {products.length === 0 && (
            <p className="text-[10px] tracking-widest text-gray-300 py-10">NO PRODUCTS</p>
          )}

          {products.map(product => (
            <div
              key={product.id}
              className="flex items-center gap-8 py-10 border-b border-gray-200"
            >
              {/* Thumbnail */}
              <div className="w-24 h-24 shrink-0 bg-gray-50 overflow-hidden">
                <img
                  src={getImageUrl(product.id, 'main')}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={e => { e.currentTarget.style.display = 'none' }}
                />
              </div>

              {/* Name */}
              <span className="flex-1 text-sm tracking-widest uppercase">
                {product.name}
              </span>

              {/* Stock edit */}
              <div className="flex items-center gap-5">
                <span className="text-xs tracking-widest text-black font-medium">STOCK</span>
                <input
                  type="number"
                  min="0"
                  value={stockEdits[product.id] ?? product.stock}
                  onChange={e => setStockEdits(p => ({ ...p, [product.id]: e.target.value }))}
                  className="w-20 border border-black text-xs tracking-widest bg-transparent outline-none text-center py-2"
                />
                <button
                  type="button"
                  onClick={() => handleSaveStock(product)}
                  className="text-xs tracking-widest border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
                >
                  SAVE
                </button>
              </div>

              {/* Remove */}
              <button
                type="button"
                onClick={() => handleDelete(product.id)}
                className="text-xs tracking-widest border border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
              >
                REMOVE
              </button>
            </div>
          ))}
        </div>

      </div>
    </main>
  )
}
