import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('userId')
    const name = localStorage.getItem('name')
    const role = localStorage.getItem('role') ?? 'USER'
    return token ? { token, userId, name, role } : null
  })

  function login({ token, userId, name, role }) {
    localStorage.setItem('token', token)
    localStorage.setItem('userId', userId)
    localStorage.setItem('name', name)
    localStorage.setItem('role', role ?? 'USER')
    setAuth({ token, userId, name, role: role ?? 'USER' })
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('name')
    localStorage.removeItem('role')
    setAuth(null)
  }

  return (
    <AuthContext.Provider value={{ auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
