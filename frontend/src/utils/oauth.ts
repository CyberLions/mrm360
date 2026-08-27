// OAuth utility functions

// OIDC login can be initiated from a different psuccso.org subdomain than the
// one Authentik redirects back to (e.g. join.psuccso.org -> mrm.psuccso.org/auth/callback).
// sessionStorage/localStorage are scoped per-origin and don't survive that hop, so
// CSRF state and the post-login redirect target are also mirrored into a cookie
// scoped to the shared parent domain, which both subdomains can read.
function getSharedCookieDomain(): string {
  const host = window.location.hostname
  if (host === 'localhost' || /^[\d.]+$/.test(host)) return ''
  const parts = host.split('.')
  if (parts.length <= 2) return ''
  return '.' + parts.slice(-2).join('.')
}

function setSharedCookie(name: string, value: string) {
  const domain = getSharedCookieDomain()
  let cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=600; SameSite=Lax`
  if (window.location.protocol === 'https:') cookie += '; Secure'
  if (domain) cookie += `; domain=${domain}`
  document.cookie = cookie
}

function getSharedCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function clearSharedCookie(name: string) {
  const domain = getSharedCookieDomain()
  let cookie = `${name}=; path=/; max-age=0`
  if (domain) cookie += `; domain=${domain}`
  document.cookie = cookie
}

export function initiateOAuthLogin(redirectUrl?: string) {
  const issuer = window.ENV.VITE_AUTHENTIK_BASE_URL
  const clientId = window.ENV.VITE_AUTHENTIK_CLIENT_ID
  const redirectUri = window.ENV.VITE_AUTHENTIK_REDIRECT_URI

  if (!issuer || !clientId || !redirectUri) {
    console.error('OIDC configuration missing')
    return
  }

  // This app is served under multiple hostnames (e.g. join.psuccso.org mirrors
  // mrm.psuccso.org at the ingress level, same pod/static assets). Authentik
  // always sends the callback back to the single canonical redirect_uri host,
  // so storing OIDC state on any other host would write it somewhere the
  // callback page can never read from. Hop to the canonical host first (its
  // own load of this same code will then run the flow below on the right origin).
  const canonicalHost = new URL(redirectUri).host
  if (window.location.host !== canonicalHost) {
    const canonicalProtocol = new URL(redirectUri).protocol
    const targetPath = redirectUrl || window.location.pathname + window.location.search
    window.location.href = `${canonicalProtocol}//${canonicalHost}${targetPath}`
    return
  }

  // Generate state parameter for CSRF protection
  const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  
  // Store state in sessionStorage/localStorage (same-origin case) and in a
  // cookie shared across psuccso.org subdomains (cross-origin case, see above)
  sessionStorage.setItem('oidc_state', state)
  localStorage.setItem('oidc_state', state)
  setSharedCookie('oidc_state', state)

  // Store redirect URL if provided, otherwise use current location
  const finalRedirectUrl = redirectUrl || window.location.pathname + window.location.search
  sessionStorage.setItem('auth_redirect_url', finalRedirectUrl)
  localStorage.setItem('auth_redirect_url', finalRedirectUrl)
  setSharedCookie('auth_redirect_url', finalRedirectUrl)
  
  console.log('Storing redirect URL for after login:', finalRedirectUrl)
  
  // Build authorization URL
  const authUrl = new URL(`${issuer}/application/o/authorize/`)
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('scope', 'openid email profile groups')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('state', state)
  
  // Redirect to Authentik
  window.location.href = authUrl.toString()
}

export function validateOAuthState(receivedState: string): boolean {
  const storedState = sessionStorage.getItem('oidc_state') || localStorage.getItem('oidc_state') || getSharedCookie('oidc_state')

  if (!storedState || storedState !== receivedState) {
    console.error('State parameter mismatch:', {
      received: receivedState,
      stored: storedState,
      sessionState: sessionStorage.getItem('oidc_state'),
      localState: localStorage.getItem('oidc_state'),
      cookieState: getSharedCookie('oidc_state')
    })
    
    // In development, allow the flow to continue even with state mismatch
    // In production, this should be strict
    if (window.ENV.DEV) {
      console.warn('State parameter mismatch in development mode, continuing anyway...')
      return true
    } else {
      return false
    }
  }
  
  return true
}

export function clearOAuthState() {
  sessionStorage.removeItem('oidc_state')
  localStorage.removeItem('oidc_state')
  clearSharedCookie('oidc_state')
}

export function getStoredRedirectUrl(): string | null {
  return sessionStorage.getItem('auth_redirect_url') || localStorage.getItem('auth_redirect_url') || getSharedCookie('auth_redirect_url')
}

export function clearStoredRedirectUrl() {
  sessionStorage.removeItem('auth_redirect_url')
  localStorage.removeItem('auth_redirect_url')
  clearSharedCookie('auth_redirect_url')
}

export function initiateOAuthLogout() {
  const issuer = window.ENV.VITE_AUTHENTIK_BASE_URL
  const clientId = window.ENV.VITE_AUTHENTIK_CLIENT_ID
  const logoutEndpoint = window.ENV.VITE_AUTHENTIK_LOGOUT_ENDPOINT
  
  if (!issuer || !clientId || !logoutEndpoint) {
    console.error('OIDC configuration missing for logout')
    return
  }

  console.log('Initiating OIDC logout...')
  
  // Clear all stored authentication data
  clearOAuthState()
  clearStoredRedirectUrl()
  localStorage.removeItem('accessToken')
  localStorage.removeItem('userData')
  
  // Build logout URL for Authentik end-session
  const logoutUrl = new URL(`${issuer}${logoutEndpoint}`)
  logoutUrl.searchParams.set('client_id', clientId)
  
  console.log('Redirecting to Authentik logout:', logoutUrl.toString())
  
  // Redirect to Authentik logout
  window.location.href = logoutUrl.toString()
}
