import api from '../api/axios'

export const login = (email, password) =>
  api.post('/api/v1/auth/login', { email, password }).then(r => r.data)

export const register = (name, email, password) =>
  api.post('/api/v1/users/register', { name, email, password }).then(r => r.data)
