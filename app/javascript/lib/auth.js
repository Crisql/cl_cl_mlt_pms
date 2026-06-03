// Authentication / authorization utilities
// Migrated from: legacy Angular PMS
//   - src/app/core/services/authentication.service.ts
//   - src/app/core/services/data-storage.service.ts

import { getSession, getCurrentCompany, getCurrentProcess } from "lib/api_helpers"

/**
 * Read a base64(JSON) object stored by @clavisco/core Repository.Behavior.SetStorage.
 * @param {string} key - localStorage key
 * @returns {Object|null}
 */
export function getStorageObject(key) {
  const raw = localStorage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(atob(raw))
  } catch (_e) {
    return null
  }
}

/**
 * Store an object as base64(JSON), like Repository.Behavior.SetStorage.
 */
export function setStorageObject(key, obj) {
  localStorage.setItem(key, btoa(JSON.stringify(obj)))
}

/**
 * Checks if the user is authenticated by validating the current session token.
 * Replicates AuthenticationService.IsAuthenticated():
 * compares ExpireTime against the current date converted to UTC.
 * @returns {boolean}
 */
export function isAuthenticated() {
  try {
    const session = getSession()
    if (!session) return false

    const expires = new Date(session.ExpireTime)
    const today = new Date()
    const currentUTCDate = new Date(today.getTime() + today.getTimezoneOffset() * 60000)

    return currentUTCDate < expires
  } catch (e) {
    console.error("Error decoding session:", e)
    return false
  }
}

/**
 * Checks if a company has been selected (sessionStorage SelectedCompany).
 * Replicates AuthenticationService.HaveSelectedCompany().
 * @returns {boolean}
 */
export function haveSelectedCompany() {
  return !!getCurrentCompany()
}

/**
 * Get the user's access permissions from RoleAccess storage.
 * Replicates DataStorageService.GetUserAccess().
 * @returns {string[]}
 */
export function getUserAccess() {
  const perms = getStorageObject("RoleAccess")
  return perms?.Access || []
}

/**
 * Checks if the user has a specific permission.
 * Replicates AuthenticationService.HavePerm().
 * @param {string} perm
 * @returns {boolean}
 */
export function havePerm(perm) {
  return getUserAccess().includes(perm)
}

/**
 * Checks if the selected company has the required configuration for a process.
 * Replicates AuthenticationService.HaveConfigAdded(process).
 * @param {string} [process] - 'HTH', 'TXT' or '' (any)
 * @returns {boolean}
 */
export function haveConfigAdded(process = "") {
  const company = getCurrentCompany()
  const selectedProcess = getCurrentProcess()
  if (!company) return false

  const hasHTH = selectedProcess === "HTH" && (company.ListConfHTH || []).length > 0
  const hasTXT = selectedProcess === "TXT" && company.ConfigTXT != null && company.ConfigTXT.length > 0

  if (process === "HTH") return hasHTH
  if (process === "TXT") return hasTXT
  return hasHTH || hasTXT
}
