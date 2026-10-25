import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { AuthService } from '../lib/auth'

interface AuthContextType {
  user: any
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  loginWithProvider: (provider: 'google' | 'azure') => Promise<void>
  logout: () => Promise<void>
  getCurrentUser: () => Promise<any>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  const authService = AuthService.getInstance()

  useEffect(() => {
    // Initialize auth service
    const initializeAuth = async () => {
      try {
        await authService.initialize()
        const currentUser = await authService.getCurrentUser()
        setUser(currentUser)
        setIsAuthenticated(!!currentUser)
      } catch (error) {
        console.error('Auth initialization error:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Cleanup on unmount
    return () => {
      authService.cleanup()
    }
  }, [])

  // Listen for auth state changes
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'pubrooter_session_id') {
        if (event.newValue === null) {
          // Session removed, user logged out
          setUser(null)
          setIsAuthenticated(false)
        } else {
          // Session added, user logged in
          authService.getCurrentUser().then(currentUser => {
            setUser(currentUser)
            setIsAuthenticated(!!currentUser)
          }).catch(console.error)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      await authService.signIn(email, password)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      setIsAuthenticated(true)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, name: string) => {
    setIsLoading(true)
    try {
      await authService.signUp(email, password, { name })
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      setIsAuthenticated(true)
    } finally {
      setIsLoading(false)
    }
  }

  const loginWithProvider = async (provider: 'google' | 'azure') => {
    setIsLoading(true)
    try {
      await authService.signInWithProvider(provider)
      const currentUser = await authService.getCurrentUser()
      setUser(currentUser)
      setIsAuthenticated(true)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      await authService.signOut()
      setUser(null)
      setIsAuthenticated(false)
    } finally {
      setIsLoading(false)
    }
  }

  const getCurrentUser = async () => {
    return await authService.getCurrentUser()
  }

  const value = {
    user,
    isAuthenticated,
    isLoading,
    login,
    register,
    loginWithProvider,
    logout,
    getCurrentUser
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}