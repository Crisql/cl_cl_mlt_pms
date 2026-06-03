/**
 * @clavisco/core - Core utilities and structures
 * Migrated from Angular to vanilla JavaScript for Rails/Stimulus.
 * Base port taken from ema-ui-migration; the Storage section is adapted to
 * the PMS session conventions:
 *   - localStorage "CurrentSession" stores the token object as base64(JSON)
 *     (Repository.Behavior.SetStorage / GetStorageObject behaviour)
 *   - sessionStorage "SelectedCompany" stores the selected company as JSON
 */

// ============================================================
// ENUMS
// ============================================================

export const CL_DISPLAY = {
  SUCCESS: 0,
  INFORMATION: 1,
  WARNING: 2,
  ERROR: 3
}

export const CL_ACTIONS = {
  CREATE: 0,
  UPDATE: 1,
  DELETE: 2,
  READ: 3,
  DISMISS: 4,
  CONTINUE: 5,
  CANCEL: 6,
  OPTION_1: 7,
  OPTION_2: 8,
  OPTION_3: 9,
  OPTION_4: 10,
  OPTION_5: 11,
  OPTION_6: 12,
  OPTION_7: 13,
  OPTION_8: 14,
  OPTION_9: 15,
  OPTION_10: 16,
  OPTION_11: 17,
  OPTION_12: 18,
  OPTION_13: 19,
  OPTION_14: 20,
  OPTION_15: 21
}

export const TOKENS = {
  ALERTS: 'ALERTS',
  CORE: 'CORE',
  GUARD: 'GUARD',
  HOME: 'HOME',
  LINK: 'LINKER',
  LOGN: 'LOGIN',
  MENU: 'MENU',
  OVLAY: 'OVERLAY',
  RPMG_DK: 'REPORT MANAGER DESK',
  RPMG_MN: 'REPORT MANAGER MENU',
  SKTN: 'SKELETON',
  SHARED: 'SHARED',
  TABL: 'TABLE'
}

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

/**
 * Validates an email with standard format
 */
export function isValidEmail(email) {
  return /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/.test(email)
}

/**
 * Deep object comparison
 */
export function deepEqual(object1, object2) {
  const keys1 = Object.keys(object1)
  const keys2 = Object.keys(object2)

  if (keys1.length !== keys2.length) return false

  for (const key of keys1) {
    const val1 = object1[key]
    const val2 = object2[key]
    const areObjects = isObject(val1) && isObject(val2)
    if ((areObjects && !deepEqual(val1, val2)) || (!areObjects && val1 !== val2)) {
      return false
    }
  }
  return true
}

export function isObject(object) {
  return object != null && typeof object === 'object'
}

/**
 * Custom console logging with formatting
 */
export function clPrint(data, displayType = CL_DISPLAY.ERROR) {
  const backgrounds = {
    [CL_DISPLAY.SUCCESS]: '#00cc66',
    [CL_DISPLAY.INFORMATION]: '#0099ff',
    [CL_DISPLAY.WARNING]: '#ff9900',
    [CL_DISPLAY.ERROR]: '#cc3300'
  }

  const labels = {
    [CL_DISPLAY.SUCCESS]: 'SUCCESS',
    [CL_DISPLAY.INFORMATION]: 'INFORMATION',
    [CL_DISPLAY.WARNING]: 'WARNING',
    [CL_DISPLAY.ERROR]: 'ERROR'
  }

  let message = typeof data === 'object' ? getError(data) : data

  console.log(
    `%c[CL - ${labels[displayType]}]`,
    `background: ${backgrounds[displayType]}; color: #fff; padding: 2px 6px; font-size: 12px;`,
    message
  )
}

/**
 * Extract error message from various error object formats
 */
export function getError(error) {
  if (!error) return 'Unknown error'

  if (error.error?.errorInfo?.Message) return error.error.errorInfo.Message
  if (error.error?.error_description) return error.error.error_description
  if (error.error?.Message) return error.error.Message
  if (error.message) return error.message
  if (error.errorInfo?.Message) return error.errorInfo.Message
  if (error.error) return error.error
  if (error.Message) return error.Message
  if (error.Error?.Message) return `${error.Error.Code ? error.Error.Code + ' - ' : ''}${error.Error.Message}`

  return typeof error === 'string' ? error : JSON.stringify(error)
}

/**
 * Download a file from base64 string
 */
export function downloadBase64File(base64File, fileName, blobType, fileExtension) {
  try {
    if (!base64File) throw new Error("The string in base64 must not be empty")
    if (!fileName) throw new Error("The file name must not be empty")
    if (!blobType) throw new Error("The blob type must not be empty")
    if (!fileExtension) throw new Error("The file extension must not be empty")

    const arrayBuffer = stringToArrayBuffer(atob(base64File))
    if (!arrayBuffer) throw new Error("There was an error generating the buffer array")

    const blob = new Blob([arrayBuffer], { type: blobType })
    const link = document.createElement('a')
    link.href = window.URL.createObjectURL(blob)
    link.download = `${fileName}.${fileExtension}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  } catch (error) {
    clPrint(error, CL_DISPLAY.ERROR)
  }
}

/**
 * Print or open a base64 file
 */
export function printBase64File({ base64File, blobType, onNewWindow }) {
  const byteCharacters = atob(base64File)
  const byteNumbers = new Array(byteCharacters.length)

  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i)
  }

  const byteArray = new Uint8Array(byteNumbers)
  const blob = new Blob([byteArray], { type: blobType })
  const blobURL = URL.createObjectURL(blob)

  const iframe = document.createElement('iframe')
  document.body.appendChild(iframe)
  iframe.style.display = 'none'
  iframe.src = blobURL

  iframe.onload = function() {
    setTimeout(function() {
      if (onNewWindow) {
        const tabOrWindow = window.open(iframe.src, '_blank')
        tabOrWindow?.focus()
      } else {
        iframe.focus()
        iframe.contentWindow?.print()
      }
    }, 1)
  }
}

/**
 * Convert string to ArrayBuffer
 */
export function stringToArrayBuffer(toConvert) {
  try {
    const arrayBuffer = new ArrayBuffer(toConvert.length)
    const uInt8Array = new Uint8Array(arrayBuffer)

    for (let i = 0; i < toConvert.length; i++) {
      uInt8Array[i] = toConvert.charCodeAt(i) & 0xff
    }

    return arrayBuffer
  } catch (error) {
    clPrint(error, CL_DISPLAY.ERROR)
    return null
  }
}

export function uriDecode(text) {
  try {
    return decodeURIComponent(text)
  } catch (error) {
    console.info('Error decoding text:', error)
    return text
  }
}

export function uriEncode(text) {
  try {
    return encodeURIComponent(text)
  } catch (error) {
    console.error('Error encoding text:', text)
    return text
  }
}

// ============================================================
// STORAGE SERVICE (PMS conventions)
// ============================================================

export const Storage = {
  /**
   * Get a base64(JSON) object from localStorage
   * (Repository.Behavior.GetStorageObject)
   */
  get(key) {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
      return JSON.parse(atob(raw))
    } catch {
      // fallback for plain JSON values
      try { return JSON.parse(raw) } catch { return raw }
    }
  },

  /**
   * Set an object in localStorage as base64(JSON)
   * (Repository.Behavior.SetStorage)
   */
  set(key, value) {
    localStorage.setItem(key, btoa(JSON.stringify(value)))
  },

  remove(key) {
    localStorage.removeItem(key)
  },

  /**
   * Get a JSON object from sessionStorage
   */
  getSessionObject(key) {
    const raw = sessionStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  },

  /**
   * Set a JSON object in sessionStorage
   */
  setSessionObject(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value))
  },

  removeSessionObject(key) {
    sessionStorage.removeItem(key)
  },

  /**
   * Get the current session (PMS: localStorage "CurrentSession", base64)
   */
  getSession() {
    return this.get('CurrentSession')
  },

  /**
   * Get the selected company (PMS: sessionStorage "SelectedCompany", JSON)
   */
  getCurrentCompany() {
    return this.getSessionObject('SelectedCompany')
  },

  /**
   * Get auth token
   */
  getToken() {
    const session = this.getSession()
    return session?.access_token || null
  },

  /**
   * Get company ID (PMS default: 0 when no company selected)
   */
  getCompanyId() {
    const company = this.getCurrentCompany()
    return company?.Id || 0
  }
}

// Default export
export default {
  CL_DISPLAY,
  CL_ACTIONS,
  TOKENS,
  isValidEmail,
  deepEqual,
  isObject,
  clPrint,
  getError,
  downloadBase64File,
  printBase64File,
  stringToArrayBuffer,
  uriDecode,
  uriEncode,
  Storage
}
