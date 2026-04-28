import api from '../api/axios'

export const getProducts = (category) =>
  api.get('/api/v1/products', { params: category ? { category } : {} }).then(r => r.data)

export const getProduct = (id) =>
  api.get(`/api/v1/products/${id}`).then(r => r.data)

export const getCategories = () =>
  api.get('/api/v1/products/categories').then(r => r.data)
