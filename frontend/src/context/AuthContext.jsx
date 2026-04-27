import { createContext, useContext, useState } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState(() => {
    const token = localStorage.getItem('token')
    const userId = localStorage.getItem('userId')
    const name = localStorage.getItem('name')
    return token ? { token, userId, name } : null
  })

  function login({ token, userId, name }) {
    localStorage.setItem('token', token)
    localStorage.setItem('userId', userId)
    localStorage.setItem('name', name)
    setAuth({ token, userId, name })
  }

  function logout() {
    localStorage.removeItem('token')
    localStorage.removeItem('userId')
    localStorage.removeItem('name')
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
