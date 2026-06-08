// Cryptography utilities — réplica de CryptographyService del Angular PMS
// (crypto-js AES-CBC con key/iv fijos, PKCS7, salida Base64).
// Implementado con WebCrypto (AES-CBC + PKCS7 nativo) — compatible byte a byte
// con crypto-js cuando se usa key explícita (no passphrase).

const KEY_STRING = "C1Av!sC0)!$02021" // 16 bytes (AES-128)
const IV_STRING = "$$C1Av!sC0)!$100" // 16 bytes

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function getKeyBytes() {
  return encoder.encode(KEY_STRING)
}

function getIvBytes() {
  return encoder.encode(IV_STRING)
}

async function importKey() {
  return crypto.subtle.importKey("raw", getKeyBytes(), { name: "AES-CBC" }, false, ["encrypt", "decrypt"])
}

function bytesToBase64(bytes) {
  let binary = ""
  const arr = new Uint8Array(bytes)
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Replica CryptographyService.encryptData: AES-CBC(data) → Base64
 * @param {string} data
 * @returns {Promise<string>}
 */
export async function encryptData(data) {
  const key = await importKey()
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-CBC", iv: getIvBytes() }, key, encoder.encode(data))
  return bytesToBase64(ciphertext)
}

/**
 * Replica CryptographyService.decryptData: Base64 → texto plano
 * @param {string} encryptedB64
 * @returns {Promise<string>}
 */
export async function decryptData(encryptedB64) {
  const key = await importKey()
  const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv: getIvBytes() }, key, base64ToBytes(encryptedB64))
  return decoder.decode(plaintext)
}

/**
 * Replica SelectCompanyComponent.UpdateSessionLicence:
 * re-escribe CurrentSession.Licence = AES(sapUser) (o '' si vacío).
 * @param {string} sapUser
 */
export async function updateSessionLicence(sapUser) {
  const sessionRaw = localStorage.getItem("CurrentSession")
  if (!sessionRaw) return

  const sessionObj = JSON.parse(atob(sessionRaw))
  sessionObj.Licence = sapUser ? await encryptData(sapUser) : ""
  localStorage.setItem("CurrentSession", btoa(JSON.stringify(sessionObj)))
}
