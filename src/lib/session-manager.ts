import { supabase } from './supabase'

export interface Session {
  id: string
  userId: string
  email: string
  name: string
  avatar?: string
  provider: 'email' | 'google' | 'azure'
  createdAt: string
  lastAccess: string
  expiresAt: string
  token?: string
  refreshToken?: string
  isActive: boolean
}

export class SessionManager {
  private static instance: SessionManager
  private sessions: Map<string, Session> = new Map()
  private tokenCache: Map<string, string> = new Map()

  public static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager()
    }
    return SessionManager.instance
  }

  async createSession(userData: {
    user: any
    provider?: 'email' | 'google' | 'azure'
    email: string
    name: string
    avatar?: string
  }): Promise<Session> {
    try {
      // Generate secure session ID
      const sessionId = this.generateSecureId()
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours

      const session: Session = {
        id: sessionId,
        userId: userData.user?.id || this.generateUserId(),
        email: userData.email,
        name: userData.name,
        avatar: userData.avatar,
        provider: userData.provider || 'email',
        createdAt: now.toISOString(),
        lastAccess: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
        isActive: true
      }

      // Store in memory cache
      this.sessions.set(sessionId, session)

      // Store in database if available
      if (supabase) {
        await this.storeSessionInDatabase(session)
      }

      // Generate and store tokens
      if (userData.user?.id) {
        const tokens = await this.generateTokens(userData.user.id)
        session.token = tokens.accessToken
        session.refreshToken = tokens.refreshToken
        await this.storeTokens(session.id, tokens.accessToken, tokens.refreshToken)
      }

      // Update last access
      this.updateLastAccess(sessionId)

      return session
    } catch (error) {
      console.error('Error creating session:', error)
      throw new Error('Failed to create session')
    }
  }

  async validateSession(sessionId: string): Promise<Session | null> {
    try {
      // Check memory cache first
      let session = this.sessions.get(sessionId)

      if (!session) {
        // Try to load from database
        session = await this.loadSessionFromDatabase(sessionId)
      }

      if (!session) {
        return null // Session not found
      }

      // Check if session is expired
      if (this.isExpired(session)) {
        await this.invalidateSession(sessionId)
        return null
      }

      // Update last access
      this.updateLastAccess(sessionId)

      return session
    } catch (error) {
      console.error('Error validating session:', error)
      return null
    }
  }

  async refreshSession(sessionId: string, refreshToken: string): Promise<Session | null> {
    try {
      // Validate refresh token
      const isValid = await this.validateRefreshToken(sessionId, refreshToken)
      if (!isValid) {
        throw new Error('Invalid refresh token')
      }

      // Get current session
      let session = this.sessions.get(sessionId)
      if (!session) {
        session = await this.loadSessionFromDatabase(sessionId)
      }

      if (!session) {
        return null
      }

      // Generate new tokens
      const newTokens = await this.generateTokens(session.userId)
      session.token = newTokens.accessToken
      session.refreshToken = newTokens.refreshToken
      session.lastAccess = new Date().toISOString()

      // Update session
      this.sessions.set(sessionId, session)

      if (supabase) {
        await this.updateSessionInDatabase(session)
      }

      await this.storeTokens(sessionId, newTokens.accessToken, newTokens.refreshToken)

      return session
    } catch (error) {
      console.error('Error refreshing session:', error)
      return null
    }
  }

  async invalidateSession(sessionId: string): Promise<void> {
    try {
      this.sessions.delete(sessionId)

      if (supabase) {
        await this.deleteSessionFromDatabase(sessionId)
      }

      // Invalidate associated tokens
      this.tokenCache.delete(sessionId)
    } catch (error) {
      console.error('Error invalidating session:', error)
      throw error
    }
  }

  async signOut(sessionId: string): Promise<void> {
    await this.invalidateSession(sessionId)
  }

  isExpired(session: Session): boolean {
    return new Date() > new Date(session.expiresAt)
  }

  private generateSecureId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 12)}`
  }

  private async generateTokens(userId: string): Promise<{ accessToken: string, refreshToken: string }> {
    // Generate secure random tokens
    const accessToken = this.generateSecureToken()
    const refreshToken = this.generateSecureToken()

    // Store tokens securely
    this.tokenCache.set(userId, accessToken)

    return { accessToken, refreshToken }
  }

  private generateSecureToken(): string {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  private async storeSessionInDatabase(session: Session): Promise<void> {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('sessions')
        .insert({
          id: session.id,
          user_id: session.userId,
          email: session.email,
          name: session.name,
          avatar: session.avatar,
          provider: session.provider,
          created_at: session.createdAt,
          last_access: session.lastAccess,
          expires_at: session.expiresAt,
          is_active: session.isActive,
          token: session.token,
          refresh_token: session.refreshToken
        })

      if (error) {
        console.error('Error storing session in database:', error)
        throw error
      }
    } catch (error) {
      console.error('Error storing session:', error)
      throw error
    }
  }

  private async loadSessionFromDatabase(sessionId: string): Promise<Session | null> {
    if (!supabase) return null

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('id', sessionId)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          return null // Not found
        }
        throw error
      }

      if (!data) return null

      return {
        id: data.id,
        userId: data.user_id,
        email: data.email,
        name: data.name,
        avatar: data.avatar,
        provider: data.provider,
        createdAt: data.created_at,
        lastAccess: data.last_access,
        expiresAt: data.expires_at,
        token: data.token,
        refreshToken: data.refresh_token,
        isActive: data.is_active
      }
    } catch (error) {
      console.error('Error loading session from database:', error)
      return null
    }
  }

  private async updateSessionInDatabase(session: Session): Promise<void> {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('sessions')
        .update({
          last_access: session.lastAccess,
          expires_at: session.expiresAt,
          token: session.token,
          refresh_token: session.refreshToken,
          is_active: session.isActive
        })
        .eq('id', session.id)

      if (error) {
        console.error('Error updating session in database:', error)
        throw error
      }
    } catch (error) {
      console.error('Error updating session:', error)
      throw error
    }
  }

  private async deleteSessionFromDatabase(sessionId: string): Promise<void> {
    if (!supabase) return

    try {
      const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)

      if (error) {
        console.error('Error deleting session from database:', error)
        throw error
      }
    } catch (error) {
      console.error('Error deleting session:', error)
      throw error
    }
  }

  private async storeTokens(userId: string, accessToken: string, refreshToken: string): Promise<void> {
    // In a real implementation, this would store tokens securely in the database
    // or use a secure token storage solution
    this.tokenCache.set(userId, accessToken)
  }

  private async validateRefreshToken(sessionId: string, refreshToken: string): Promise<boolean> {
    // Validate refresh token against database
    if (!supabase) {
      // Fallback: check if we have a valid session
      return this.sessions.has(sessionId)
    }

    try {
      const { data, error } = await supabase
        .from('sessions')
        .select('refresh_token')
        .eq('id', sessionId)
        .single()

      if (error || !data) {
        return false
      }

      return data.refresh_token === refreshToken
    } catch (error) {
      console.error('Error validating refresh token:', error)
      return false
    }
  }

  private updateLastAccess(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (session) {
      session.lastAccess = new Date().toISOString()
      this.sessions.set(sessionId, session)
    }
  }

  public getSessionCount(): number {
    return this.sessions.size
  }

  public cleanupExpiredSessions(): void {
    const now = new Date()
    for (const [sessionId, session] of this.sessions.entries()) {
      if (this.isExpired(session)) {
        this.invalidateSession(sessionId)
      }
    }
  }
}

export default SessionManager