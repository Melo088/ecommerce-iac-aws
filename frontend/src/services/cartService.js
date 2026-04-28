import api from '../api/axios'

export const getCart = () =>
  api.get('/api/v1/cart').then(r => r.data)

export const addToCart = (productId, quantity = 1) =>
  api.post('/api/v1/cart', { productId, quantity }).then(r => r.data)

export const removeFromCart = (itemId) =>
  api.delete(`/api/v1/cart/${itemId}`)

export const updateCartItemQuantity = (itemId, quantity) =>
  api.patch(`/api/v1/cart/${itemId}/quantity`, { quantity }).then(r => r.data)
