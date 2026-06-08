import { Controller } from "@hotwired/stimulus"
import { setSession, decodeResponseMessage } from "lib/api_helpers"
import { getError, isValidEmail } from "vendor/clavisco/core"
import { error as toastError, showAlert } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

// Configuración legacy del PMS (app.component SetTokenConfiguration LOGN)
const ENDPOINTS = {
  token: "/api/token",
  changePassword: "/api/Users/ChangePassword",
  recoverPassword: "/api/Users/ChangeRecoverPassword",
  sendRecoverPasswordEmail: (email) => `/api/Users/RecoverPassword/${email}`
}

const OVERLAY_MESSAGES = {
  login: "Iniciando Sesión",
  changePassword: "Cambiando Contraseña",
  sendRecoverEmail: "Enviando Correo de Recuperación",
  recoverPassword: "Actualizando Contraseña"
}

const MIN_PASSWORD_LENGTH = 8 // EnforcePasswordPolicy=true (default del cl-login)

/**
 * Login controller — réplica del cl-login (CORE) usado por el Angular PMS.
 * Análisis completo: docs/migration/comparisons/LOGIN-COMPLETE-ANALYSIS.md
 *
 * 4 vistas conmutadas (login / recover-email / change-password / recover-password),
 * mismas validaciones, mensajes, endpoints y storage que el legacy.
 */
export default class extends Controller {
  static targets = [
    "loginView", "recoverEmailView", "changePasswordView", "recoverPasswordView",
    "loginUser", "loginPass", "loginPassToggle",
    "userEmail", "sendRecoverEmailButton",
    "cpUserEmail", "currentPassword", "newPassword", "confirmPassword",
    "changePasswordButton", "cpNotEqualError",
    "rpNewPassword", "rpConfirmPassword", "recoverPasswordButton", "rpNotEqualError"
  ]

  static values = {
    redirect: { type: String, default: "/Home" },
    recoveryToken: { type: String, default: "" },
    recaptchaSiteKey: { type: String, default: "" }
  }

  connect() {
    // Legacy ReadURLParameters(): query param token → vista recover password
    if (this.recoveryTokenValue) {
      this.showView("recoverPassword")
      history.replaceState(null, "", "/Login#recovery")
    }

    if (this.recaptchaSiteKeyValue) {
      this.loadRecaptcha()
    }
  }

  // ==========================================================
  // NAVEGACIÓN ENTRE VISTAS (GoToLogin / GoToReplacePassword / GoToChangePassword)
  // Legacy: replaceState + reset de TODOS los formularios
  // ==========================================================

  showView(name) {
    this.loginViewTarget.hidden = name !== "login"
    this.recoverEmailViewTarget.hidden = name !== "recoverEmail"
    this.changePasswordViewTarget.hidden = name !== "changePassword"
    this.recoverPasswordViewTarget.hidden = name !== "recoverPassword"
  }

  resetForms() {
    this.element.querySelectorAll("form").forEach((form) => form.reset())
    this.cpNotEqualErrorTarget.hidden = true
    this.rpNotEqualErrorTarget.hidden = true
    this.sendRecoverEmailButtonTarget.disabled = true
    this.changePasswordButtonTarget.disabled = true
    this.recoverPasswordButtonTarget.disabled = true
  }

  goToLogin(event) {
    event?.preventDefault()
    history.replaceState(null, "", "/Login#login")
    this.showView("login")
    this.resetForms()
  }

  goToRecoverEmail(event) {
    event?.preventDefault()
    history.replaceState(null, "", "/Login#recovery")
    this.showView("recoverEmail")
    this.resetForms()
  }

  goToChangePassword(event) {
    event?.preventDefault()
    history.replaceState(null, "", "/Login#change-password")
    this.showView("changePassword")
    this.resetForms()
  }

  // ==========================================================
  // TOGGLES DE VISIBILIDAD
  // ==========================================================

  toggleLoginPassword() {
    const input = this.loginPassTarget
    input.type = input.type === "password" ? "text" : "password"
  }

  /** Toggle genérico: alterna el input hermano dentro del mismo contenedor */
  togglePasswordField(event) {
    const input = event.currentTarget.parentElement.querySelector("input")
    if (input) input.type = input.type === "password" ? "text" : "password"
  }

  // ==========================================================
  // reCAPTCHA v3 (action "Login")
  // ==========================================================

  loadRecaptcha() {
    if (document.querySelector("script[data-recaptcha]")) return

    const script = document.createElement("script")
    script.src = `https://www.google.com/recaptcha/api.js?render=${this.recaptchaSiteKeyValue}`
    script.dataset.recaptcha = "true"
    document.head.appendChild(script)
  }

  /** Legacy: _useReCaptcha ? recaptchaV3Service.execute("Login") : of("") */
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

  // ==========================================================
  // VISTA 1: LOGIN
  // ==========================================================

  async login(event) {
    event.preventDefault()

    const userName = this.loginUserTarget.value
    const password = this.loginPassTarget.value

    // Validaciones EXACTAS del legacy Login() (en este orden, como toasts)
    if (!userName || !password) {
      toastError("Por favor complete el formulario antes de enviarlo")
      return
    }

    if (!isValidEmail(userName)) {
      toastError("Correo en formato inválido. Sugerencia: micorreo@ejemplo.com")
      return
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toastError(`La longitud de la contraseña debe tener ${MIN_PASSWORD_LENGTH} caracteres`)
      return
    }

    showLoading(OVERLAY_MESSAGES.login)

    try {
      const recaptchaToken = await this.getRecaptchaToken()

      // Legacy CORE: POST {ApiUrl}token con body JSON {UserName, Password}.
      // Sin Authorization (AppInterceptor excluye URLs con 'token').
      const response = await fetch(ENDPOINTS.token, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cl-Recaptcha-Token": recaptchaToken
        },
        body: JSON.stringify({ UserName: userName, Password: password })
      })

      const callback = decodeResponseMessage(await response.json().catch(() => null))

      if (response.ok && callback && callback.access_token) {
        // Legacy: SetStorage(callback, 'CurrentSession') — objeto COMPLETO en base64
        setSession(callback)
        window.location.href = this.redirectValue
        return
      }

      // Respuesta sin access_token o error HTTP → toast GetError
      toastError(getError(callback || { Message: "Error de autenticación" }))
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
    }
  }

  // ==========================================================
  // VISTA 2: ENVIAR CORREO DE RECUPERACIÓN
  // ==========================================================

  validateRecoverEmailForm() {
    const email = this.userEmailTarget.value
    // Legacy: required + Validators.email → botón disabled si inválido
    this.sendRecoverEmailButtonTarget.disabled = !email || !isValidEmail(email)
  }

  async sendRecoverEmail(event) {
    event.preventDefault()
    const email = this.userEmailTarget.value

    showLoading(OVERLAY_MESSAGES.sendRecoverEmail)

    try {
      // Legacy: GET api/Users/RecoverPassword/#EMAIL# (sin Authorization)
      const response = await fetch(ENDPOINTS.sendRecoverPasswordEmail(email))
      const body = decodeResponseMessage(await response.json().catch(() => null))

      hideLoading()

      if (response.ok) {
        // Legacy: ShowAlert({Response}) + GoToLogin()
        await showAlert({ type: "success", message: body?.Message || "Correo enviado" })
        this.goToLogin()
      } else {
        await showAlert({ type: "error", message: getError(body) })
      }
    } catch (err) {
      hideLoading()
      await showAlert({ type: "error", message: getError(err) })
    }
  }

  // ==========================================================
  // VISTA 3: CAMBIAR CONTRASEÑA
  // ==========================================================

  validateChangePasswordForm() {
    const email = this.cpUserEmailTarget.value
    const current = this.currentPasswordTarget.value
    const newPass = this.newPasswordTarget.value
    const confirm = this.confirmPasswordTarget.value

    // Legacy: NotEquals(confirmPassword, newPassword) marca notEqual
    const notEqual = !!confirm && newPass !== confirm
    this.cpNotEqualErrorTarget.hidden = !notEqual

    // Legacy: required en todos + email válido + min 8 (policy) + iguales
    const valid =
      !!email && isValidEmail(email) &&
      !!current &&
      !!newPass && newPass.length >= MIN_PASSWORD_LENGTH &&
      !!confirm && !notEqual

    this.changePasswordButtonTarget.disabled = !valid
  }

  async changePassword(event) {
    event.preventDefault()

    showLoading(OVERLAY_MESSAGES.changePassword)

    try {
      // Legacy: PATCH api/Users/ChangePassword {oldPassword, newPassword, email}
      const response = await fetch(ENDPOINTS.changePassword, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oldPassword: this.currentPasswordTarget.value,
          newPassword: this.newPasswordTarget.value,
          email: this.cpUserEmailTarget.value
        })
      })
      const body = decodeResponseMessage(await response.json().catch(() => null))

      hideLoading()

      if (response.ok) {
        await showAlert({ type: "success", message: body?.Message || "Contraseña actualizada" })
        this.goToLogin()
      } else {
        await showAlert({ type: "error", message: getError(body) })
      }
    } catch (err) {
      hideLoading()
      await showAlert({ type: "error", message: getError(err) })
    }
  }

  // ==========================================================
  // VISTA 4: RECUPERAR CONTRASEÑA (token temporal del email)
  // ==========================================================

  validateRecoverPasswordForm() {
    const newPass = this.rpNewPasswordTarget.value
    const confirm = this.rpConfirmPasswordTarget.value

    const notEqual = !!confirm && newPass !== confirm
    this.rpNotEqualErrorTarget.hidden = !notEqual

    const valid = !!newPass && newPass.length >= MIN_PASSWORD_LENGTH && !!confirm && !notEqual
    this.recoverPasswordButtonTarget.disabled = !valid
  }

  async recoverPassword(event) {
    event.preventDefault()

    showLoading(OVERLAY_MESSAGES.recoverPassword)

    try {
      // Legacy: PATCH api/Users/ChangeRecoverPassword {password}
      // con Authorization: Bearer {token temporal del query param}
      const response = await fetch(ENDPOINTS.recoverPassword, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.recoveryTokenValue}`
        },
        body: JSON.stringify({ password: this.rpNewPasswordTarget.value })
      })
      const body = decodeResponseMessage(await response.json().catch(() => null))

      hideLoading()

      if (response.ok) {
        await showAlert({ type: "success", message: body?.Message || "Contraseña actualizada" })
        this.goToLogin()
      } else {
        await showAlert({ type: "error", message: getError(body) })
      }
    } catch (err) {
      hideLoading()
      await showAlert({ type: "error", message: getError(err) })
    }
  }
}
