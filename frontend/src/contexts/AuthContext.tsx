import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  apiLogin,
  apiLogout,
  apiRefresh,
  apiRegister,
  type AuthUser,
} from '../api/auth'
import { setTokenGetter } from '../api/axiosInstance'

// Access token is kept in memory only (never persisted).
// Refresh token is stored in localStorage for MVP.
const REFRESH_TOKEN_KEY = 'tm_refresh_token'
// Refresh 1 minute before expiry (access token = 15 min default).
const REFRESH_BEFORE_MS = 60_000
// Access token TTL assumption (15 min) in ms.
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string, orgName: string) => Promise<void>
  logout: () => Promise<void>
  getAccessToken: () => string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
  })

  // Access token lives only in memory.
  const accessTokenRef = useRef<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Register token getter with the shared axios instance once on mount.
  useEffect(() => {
    setTokenGetter(() => accessTokenRef.current)
  }, [])

  function scheduleRefresh() {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    refreshTimerRef.current = setTimeout(() => {
      void silentRefresh()
    }, ACCESS_TOKEN_TTL_MS - REFRESH_BEFORE_MS)
  }

  const silentRefresh = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!storedRefreshToken) {
      setState({ user: null, isAuthenticated: false, isLoading: false })
      return
    }
    try {
      const tokens = await apiRefresh(storedRefreshToken)
      accessTokenRef.current = tokens.accessToken
      localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
      scheduleRefresh()
    } catch {
      accessTokenRef.current = null
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      setState({ user: null, isAuthenticated: false, isLoading: false })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // On mount: restore session from stored refresh token.
  useEffect(() => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    if (!storedRefreshToken) {
      setState({ user: null, isAuthenticated: false, isLoading: false })
      return
    }

    apiRefresh(storedRefreshToken)
      .then((tokens) => {
        // We only have tokens on refresh — we don't have user info.
        // Store access token and schedule next refresh, but we need user info.
        // The refresh endpoint doesn't return user info, so we parse the JWT payload.
        accessTokenRef.current = tokens.accessToken
        localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken)
        const user = parseJwtUser(tokens.accessToken)
        setState({ user, isAuthenticated: true, isLoading: false })
        scheduleRefresh()
      })
      .catch(() => {
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        setState({ user: null, isAuthenticated: false, isLoading: false })
      })

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiLogin(email, password)
    accessTokenRef.current = data.accessToken
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
    setState({ user: data.user, isAuthenticated: true, isLoading: false })
    scheduleRefresh()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const register = useCallback(
    async (email: string, password: string, name: string, orgName: string) => {
      const data = await apiRegister(email, password, name, orgName)
      accessTokenRef.current = data.accessToken
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
      setState({ user: data.user, isAuthenticated: true, isLoading: false })
      scheduleRefresh()
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const logout = useCallback(async () => {
    const token = accessTokenRef.current
    accessTokenRef.current = null
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current)
    setState({ user: null, isAuthenticated: false, isLoading: false })
    if (token) {
      try {
        await apiLogout(token)
      } catch {
        // best-effort server-side logout
      }
    }
  }, [])

  const getAccessToken = useCallback(() => accessTokenRef.current, [])

  return (
    <AuthContext.Provider
      value={{ ...state, login, register, logout, getAccessToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

// Decode JWT payload without verifying signature (client-side only).
function parseJwtUser(token: string): AuthUser | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return {
      id: payload.userId as string,
      email: (payload.email as string | undefined) ?? '',
      name: (payload.name as string | undefined) ?? '',
      role: payload.role as AuthUser['role'],
    }
  } catch {
    return null
  }
}
