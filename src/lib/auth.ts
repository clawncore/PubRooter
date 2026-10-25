import { supabase } from './supabase'
import { SessionManager } from './session-manager'

export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'email' | 'google' | 'azure' | null
  createdAt: string
  emailConfirmed?: boolean
}

export interface AuthState {
  user: User | null
  session: SessionManager | null
  isLoading: boolean
  isAuthenticated: boolean
}

export class AuthService {
  private static instance: AuthService
  private currentSession: SessionManager | null = null
  private authState: AuthState = {
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService()
    }
    return AuthService.instance
  }

  async initialize(): Promise<void> {
    try {
      this.authState.isLoading = true

      // Check for existing session in localStorage
      const storedSessionId = localStorage.getItem('pubrooter_session_id')

      if (storedSessionId) {
        // Validate existing session
        const sessionManager = SessionManager.getInstance()
        const session = await sessionManager.validateSession(storedSessionId)

        if (session && !this.isExpired(session)) {
          // Load user data from session
          const user = await this.loadUserData(session.userId)
          this.currentSession = sessionManager
          this.authState.user = user
          this.authState.isAuthenticated = true
        } else {
          // Session expired or invalid, clean up
          localStorage.removeItem('pubrooter_session_id')
          await SessionManager.getInstance().invalidateSession(storedSessionId)
        }
      }

      // Set up auth state change listeners if supabase is available
      if (supabase) {
        this.setupAuthListeners()
      }
    } finally {
      this.authState.isLoading = false
    }
  }

  private isExpired(session: any): boolean {
    return new Date() > new Date(session.expiresAt)
  }

  private async loadUserData(userId: string): Promise<User> {
    if (!supabase) {
      // Fallback to local storage for demo purposes
      const stored = localStorage.getItem('pubrooter_user_data')
      if (stored) {
        return JSON.parse(stored)
      }
      throw new Error('User not found')
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw error
      }

      return {
        id: data.id,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        provider: data.provider,
        createdAt: data.created_at,
        emailConfirmed: data.email_confirmed
      }
    } catch (error) {
      console.error('Error loading user data:', error)
      throw new Error('Failed to load user data')
    }
  }

  private setupAuthListeners(): void {
    if (!supabase) return

    // Listen for auth state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await this.handleSignIn(session.user)
          }
        } else if (event === 'SIGNED_OUT') {
          await this.handleSignOut()
        }
      }
    )

    // Store the subscription for cleanup
    this.authListener = authListener
  }

  private async handleSignIn(user: any): Promise<void> {
    try {
      // Create a session for the user
      const sessionManager = SessionManager.getInstance()
      const session = await sessionManager.createSession({
        user,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
        provider: user.app_metadata?.provider || 'email'
      })

      this.currentSession = sessionManager
      this.authState.session = sessionManager
      this.authState.user = {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name || user.email.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
        provider: user.app_metadata?.provider || 'email',
        createdAt: user.created_at,
        emailConfirmed: user.email_confirmed
      }
      this.authState.isAuthenticated = true

      // Store session ID in localStorage
      localStorage.setItem('pubrooter_session_id', session.id)

      // Load user profile
      const userData = await this.loadUserData(user.id)
      this.authState.user = { ...this.authState.user, ...userData }
    } catch (error) {
      console.error('Error handling sign in:', error)
      await this.handleSignOut()
    }
  }

  private async handleSignOut(): Promise<void> {
    try {
      if (this.currentSession) {
        await this.currentSession.invalidateSession(this.currentSession.id)
        this.currentSession = null
      }

      this.authState.user = null
      this.authState.session = null
      this.authState.isAuthenticated = false

      localStorage.removeItem('pubrooter_session_id')
    } catch (error) {
      console.error('Error handling sign out:', error)
    }
  }

  async signIn(email: string, password: string): Promise<void> {
    if (!supabase) {
      throw new Error('Authentication service not configured')
    }

    try {
      this.authState.isLoading = true
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        await this.handleSignIn(data.user)
      }
    } finally {
      this.authState.isLoading = false
    }
  }

  async signUp(email: string, password: string, userData: { name: string, avatar?: string }): Promise<void> {
    if (!supabase) {
      throw new Error('Authentication service not configured')
    }

    try {
      this.authState.isLoading = true
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name: userData.name,
            avatar: userData.avatar
          }
        }
      })

      if (error) {
        throw new Error(error.message)
      }

      if (data.user) {
        await this.handleSignIn(data.user)
      }
    } finally {
      this.authState.isLoading = false
    }
  }

  async signInWithProvider(provider: 'google' | 'azure'): Promise<void> {
    if (!supabase) {
      throw new Error('Authentication service not configured')
    }

    try {
      this.authState.isLoading = true
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })

      if (error) {
        throw new Error(error.message)
      }
    } finally {
      this.authState.isLoading = false
    }
  }

  async signOut(): Promise<void> {
    try {
      if (supabase) {
        await supabase.auth.signOut()
      }

      await this.handleSignOut()
    } catch (error) {
      console.error('Error signing out:', error)
      throw error
    }
  }

  async getCurrentUser(): Promise<User | null> {
    return this.authState.user
  }

  async getCurrentSession(): Promise<SessionManager | null> {
    return this.authState.session
  }

  isLoading(): boolean {
    return this.authState.isLoading
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated
  }

  getUserEmail(): string | null {
    return this.authState.user?.email || null
  }

  getUserName(): string | null {
    return this.authState.user?.name || null
  }

  cleanup(): void {
    if (this.currentSession) {
      this.currentSession.cleanupExpiredSessions()
    }
  }
}

export default AuthService
export { SessionManager }