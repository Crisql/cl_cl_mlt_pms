// Shared API helper functions
// Replicates the legacy Angular PMS interceptors EXACTLY:
//   - AppInterceptor (Authorization + cl-company-id)
//   - HttpAlertDecodedInterceptor (decodeURIComponent of Message)
// Session conventions (PMS, different from EMA):
//   - localStorage "CurrentSession" stores the token object as base64(JSON)
//   - sessionStorage "SelectedCompany" stores the selected company as JSON

/**
 * Get the current session (token object) from localStorage.
 * Legacy: DataStorageService.GetCurrentSession() → JSON.parse(atob(storage))
 * @returns {Object|null} Session with access_token, ExpireTime, etc.
 */
export function getSession() {
  const raw = localStorage.getItem("CurrentSession")
  if (!raw) return null
  try {
    return JSON.parse(atob(raw))
  } catch (e) {
    console.error("Error decoding session:", e)
    return null
  }
}

/**
 * Store the session object as base64(JSON), like Repository.Behavior.SetStorage.
 * @param {Object} session - Token response object
 */
export function setSession(session) {
  localStorage.setItem("CurrentSession", btoa(JSON.stringify(session)))
}

/**
 * Get the selected company from sessionStorage.
 * Legacy: DataStorageService.GetCurrentCompany() → sessionStorage "SelectedCompany"
 * @returns {Object|null} ICompany with Id, etc.
 */
export function getCurrentCompany() {
  const company = sessionStorage.getItem("SelectedCompany")
  return company ? JSON.parse(company) : null
}

/**
 * Store the selected company in sessionStorage (JSON, not base64).
 * @param {Object} company - ICompany object
 */
export function setCurrentCompany(company) {
  sessionStorage.setItem("SelectedCompany", JSON.stringify(company))
}

/**
 * Get the current process (TXT/HTH) from sessionStorage.
 * Legacy: DataStorageService.GetCurrentProcces()
 * @returns {string|null}
 */
export function getCurrentProcess() {
  const process = sessionStorage.getItem("Process")
  return process ? JSON.parse(process) : null
}

/**
 * Build API headers matching the legacy Angular AppInterceptor:
 *   - Authorization: Bearer {access_token}  (always, when authenticated)
 *   - cl-company-id: {Id}                   (ONLY when a company is selected; default '0')
 * Plus optional clavisco interceptor headers (descriptions, pagination).
 * @param {Object} options
 * @param {string} [options.successDescription] - cl-request-success-description
 * @param {string} [options.errorDescription] - cl-request-error-description
 * @param {number} [options.page] - cl-sl-pagination-page
 * @param {number} [options.pageSize] - cl-sl-pagination-page-size
 * @returns {Object} Headers object for fetch()
 */
export function getAPIHeaders(options = {}) {
  const session = getSession()
  const company = getCurrentCompany()

  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/plain, */*",
    "Authorization": `Bearer ${session?.access_token || ""}`
  }

  // Legacy AppInterceptor: cl-company-id is added ONLY if a company is selected
  if (company) {
    headers["cl-company-id"] = String(company.Id ?? "0")
  }

  if (options.successDescription) {
    headers["cl-request-success-description"] = options.successDescription
  }
  if (options.errorDescription) {
    headers["cl-request-error-description"] = options.errorDescription
  }
  if (options.page !== undefined) {
    headers["cl-sl-pagination-page"] = String(options.page)
  }
  if (options.pageSize !== undefined) {
    headers["cl-sl-pagination-page-size"] = String(options.pageSize)
  }

  return headers
}

/**
 * Decode the Message field of an API response body, replicating
 * HttpAlertDecodedInterceptor (decodeURIComponent on body.Message).
 * Safe no-op when there is no Message.
 * @param {Object} body - Parsed JSON response body (ICLResponse)
 * @returns {Object} Same body with decoded Message
 */
export function decodeResponseMessage(body) {
  if (body && typeof body.Message === "string") {
    try {
      body.Message = decodeURIComponent(body.Message)
    } catch (_e) {
      // keep original Message if malformed URI sequence
    }
  }
  return body
}

/**
 * fetch() wrapper that applies the legacy interceptor behaviour:
 * auth headers + Message decoding. Returns { ok, status, body, response }.
 * @param {string} url - Relative URL ("/api/...")
 * @param {Object} [init] - fetch init (method, body, etc.)
 * @param {Object} [headerOptions] - Options for getAPIHeaders()
 */
export async function apiFetch(url, init = {}, headerOptions = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { ...getAPIHeaders(headerOptions), ...(init.headers || {}) }
  })

  let body = null
  const contentType = response.headers.get("Content-Type") || ""
  if (contentType.includes("application/json")) {
    body = decodeResponseMessage(await response.json())
  } else {
    body = await response.text()
  }

  return { ok: response.ok, status: response.status, body, response }
}
