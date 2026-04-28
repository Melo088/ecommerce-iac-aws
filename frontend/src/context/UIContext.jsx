import { createContext, useContext, useState } from 'react'

const UIContext = createContext(null)

export function UIProvider({ children }) {
  const [gridDense, setGridDense] = useState(true)
  const toggleGrid = () => setGridDense(v => !v)

  return (
    <UIContext.Provider value={{ gridDense, toggleGrid }}>
      {children}
    </UIContext.Provider>
  )
}

export function useUI() {
  return useContext(UIContext)
}
