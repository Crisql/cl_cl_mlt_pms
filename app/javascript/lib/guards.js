// Navigation guards
// Migrated from: legacy Angular PMS
//   - src/app/core/guards/auth.guard.ts
//   - AuthenticationService.Logout() / LogOutAndNotify()

import { isAuthenticated } from "lib/auth"

/**
 * Clears all session data, replicating AuthenticationService.Logout():
 * KeyMenu, ListCompanies, CurrentSession, SelectedCompany, Process,
 * RoleAccess, ExchangeRateBCCR, AutoBatchProcessor.
 */
export function clearSession() {
  try {
    localStorage.removeItem("KeyMenu")
    localStorage.removeItem("ListCompanies")
    localStorage.removeItem("CurrentSession")
    localStorage.removeItem("RoleAccess")
    sessionStorage.removeItem("SelectedCompany")
    sessionStorage.removeItem("Process")
    sessionStorage.removeItem("ExchangeRateBCCR")
    sessionStorage.removeItem("AutoBatchProcessor")
  } catch (e) {
    console.log(e)
  }
}

/**
 * Logs out and redirects to login.
 * Legacy redirects to /Login (optionally with redirectURL param).
 * @param {string} [redirectURL] - Path to return to after re-login
 */
export function logout(redirectURL) {
  clearSession()
  const target = redirectURL
    ? `/Login?redirectURL=${encodeURIComponent(redirectURL)}`
    : "/Login"
  window.location.href = target
}

/**
 * Auth guard — replicates Angular AuthGuard: when not authenticated,
 * logout and redirect to /Login keeping the attempted URL as redirectURL.
 * Call at the top of each protected Stimulus controller's connect().
 * @returns {boolean} true when authenticated and navigation may proceed
 */
export function authGuard() {
  if (!isAuthenticated()) {
    logout(window.location.pathname + window.location.search)
    return false
  }
  return true
}

/**
 * Turbo navigation hook: blocks visits to protected pages with no valid token.
 */
export function handleBeforeVisit(event) {
  const url = new URL(event.detail.url)
  const publicPaths = ["/Login", "/"]
  if (!publicPaths.includes(url.pathname) && !isAuthenticated()) {
    event.preventDefault()
    logout(url.pathname + url.search)
  }
}

/**
 * Initialize global guards. Call once from application.js.
 */
export function initGuards() {
  document.addEventListener("turbo:before-visit", handleBeforeVisit)
}
