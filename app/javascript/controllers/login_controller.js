import { Controller } from "@hotwired/stimulus"
import { setSession } from "lib/api_helpers"
import { getError } from "vendor/clavisco/core"
import { error as toastError } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * Login controller — replica del flujo CORE de @clavisco/login usado por el
 * Angular PMS (LoginContainerComponent):
 *
 *   1. Al entrar a /Login se limpia el storage (StorageService.CleanStorage()).
 *   2. Submit → reCAPTCHA v3 execute("Login") cuando hay site key.
 *   3. POST /api/token con body JSON { UserName, Password } y headers
 *      Content-Type: application/json + Cl-Recaptcha-Token.
 *   4. Éxito (callback.access_token) → guardar respuesta COMPLETA como
 *      base64(JSON) en localStorage "CurrentSession" y navegar a
 *      redirectURL || /Home.
 *   5. Error → toast con GetError(error).
 */
export default class extends Controller {
  static targets = ["username", "password", "submitButton"]
  static values = {
    redirect: { type: String, default: "/Home" },
    recaptchaSiteKey: { type: String, default: "" }
  }

  connect() {
    // Legacy: LoginContainerComponent.ngOnInit → StorageService.CleanStorage()
    // NOTA: CleanStorage() del @clavisco/core NO limpia localStorage; solo
    // resetea la configuración multi-ventana (no aplica en Rails). La limpieza
    // real de sesión ocurre en logout (AuthenticationService.Logout).

    if (this.recaptchaSiteKeyValue) {
      this.loadRecaptcha()
    }
  }

  loadRecaptcha() {
    if (document.querySelector("script[data-recaptcha]")) return

    const script = document.createElement("script")
    script.src = `https://www.google.com/recaptcha/api.js?render=${this.recaptchaSiteKeyValue}`
    script.dataset.recaptcha = "true"
    document.head.appendChild(script)
  }

  /**
   * Get a reCAPTCHA v3 token for the "Login" action.
   * Legacy: _useReCaptcha ? recaptchaV3Service.execute("Login") : of("")
   * @returns {Promise<string>}
   */
  getRecaptchaToken() {
    if (!this.recaptchaSiteKeyValue || !window.grecaptcha) {
      return Promise.resolve("")
    }

    return new Promise((resolve) => {
      window.grecaptcha.ready(() => {
        window.grecaptcha
          .execute(this.recaptchaSiteKeyValue, { action: "Login" })
          .then(resolve)
          .catch(() => resolve(""))
      })
    })
  }

  async submit(event) {
    event.preventDefault()

    const userName = this.usernameTarget.value.trim()
    const password = this.passwordTarget.value

    if (!userName || !password) {
      toastError("Debe ingresar usuario y contraseña")
      return
    }

    this.submitButtonTarget.disabled = true
    showLoading("Iniciando sesión...")

    try {
      const recaptchaToken = await this.getRecaptchaToken()

      // Legacy CORE flow: POST {ApiUrl}token with JSON body
      const response = await fetch("/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cl-Recaptcha-Token": recaptchaToken
        },
        body: JSON.stringify({ UserName: userName, Password: password })
      })

      const callback = await response.json().catch(() => null)

      if (response.ok && callback && callback.access_token) {
        // Legacy: Repository.Behavior.SetStorage(callback, 'CurrentSession')
        setSession(callback)
        window.location.href = this.redirectValue
        return
      }

      toastError(getError(callback || { Message: "Error de autenticación" }))
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
      this.submitButtonTarget.disabled = false
    }
  }
}
