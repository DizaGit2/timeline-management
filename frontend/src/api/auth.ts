const BASE_URL = '/api/auth'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'MANAGER' | 'VIEWER'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface LoginResponse extends AuthTokens {
  user: AuthUser
}

export interface RegisterResponse extends AuthTokens {
  user: AuthUser
  organization: { id: string; name: string }
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'ApiError'
  }
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      message = body.message ?? message
    } catch {
      // ignore parse error
    }
    throw new ApiError(res.status, message)
  }
  return res.json() as Promise<T>
}

export async function apiLogin(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<LoginResponse>(res)
}

export async function apiRegister(
  email: string,
  password: string,
  name: string,
  organizationName: string,
): Promise<RegisterResponse> {
  const res = await fetch(`${BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, organizationName }),
  })
  return handleResponse<RegisterResponse>(res)
}

export async function apiRefresh(refreshToken: string): Promise<AuthTokens> {
  const res = await fetch(`${BASE_URL}/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  return handleResponse<AuthTokens>(res)
}

export async function apiLogout(accessToken: string): Promise<void> {
  await fetch(`${BASE_URL}/logout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
  })
}
