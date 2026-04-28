import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext'
import api from '../api/axios'
import {
  addToCart as apiAdd,
  removeFromCart as apiRemove,
  updateCartItemQuantity,
} from '../services/cartService'

const CartContext = createContext(null)

export function CartProvider({ children }) {
  const { auth } = useAuth()
  const [items, setItems] = useState([])
  const [cartLoading, setCartLoading] = useState(false)

  const count = useMemo(
    () => items.reduce((sum, i) => sum + i.quantity, 0),
    [items]
  )

  useEffect(() => {
    if (auth) {
      setCartLoading(true)
      api.get('/api/v1/cart')
        .then(res => setItems(res.data))
        .catch(() => setItems([]))
        .finally(() => setCartLoading(false))
    } else {
      setItems([])
    }
  }, [auth])

  async function addToCart(productId, quantity = 1) {
    const updated = await apiAdd(productId, quantity)
    setItems(prev => {
      const exists = prev.some(i => i.productId === productId)
      return exists
        ? prev.map(i => i.productId === productId ? updated : i)
        : [...prev, updated]
    })
  }

  async function increaseQty(item) {
    const updated = await apiAdd(item.productId, 1)
    setItems(prev => prev.map(i => i.id === item.id ? updated : i))
  }

  async function decreaseQty(item) {
    const newQty = item.quantity - 1
    if (newQty <= 0) {
      await apiRemove(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
    } else {
      const updated = await updateCartItemQuantity(item.id, newQty)
      setItems(prev => prev.map(i => i.id === item.id ? updated : i))
    }
  }

  async function removeItem(item) {
    await apiRemove(item.id)
    setItems(prev => prev.filter(i => i.id !== item.id))
  }

  const reset = () => setItems([])

  return (
    <CartContext.Provider value={{
      items, count, cartLoading,
      addToCart, increaseQty, decreaseQty, removeItem, reset,
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
