import { Controller } from "@hotwired/stimulus"
import { getSession } from "lib/api_helpers"
import { isAuthenticated, haveSelectedCompany } from "lib/auth"
import { logout } from "lib/guards"

/**
 * Home controller — replica de HomeComponent del Angular PMS:
 *
 *   - ValidateSession(): sin CurrentSession → borrar y redirigir a /Login.
 *   - Con sesión y SIN compañía seleccionada → abrir SelectCompany como modal
 *     (PENDIENTE: se implementará al ejecutar "migrate SelectCompany").
 *   - Muestra fecha actual en formato yyyy-MM-dd y versión.
 */
export default class extends Controller {
  static targets = ["currentDate"]
  static values = {
    // true cuando se entra por la ruta /SelectCompany (página legacy)
    forceSelectCompany: { type: Boolean, default: false }
  }

  connect() {
    this.validateSession()
    this.renderCurrentDate()

    if (this.forceSelectCompanyValue && isAuthenticated()) {
      this.openSelectCompanyModal()
    }
  }

  validateSession() {
    const session = getSession()

    if (!session) {
      // Legacy: deleteStorage('CurrentSession') + navigate /Login
      logout()
      return
    }

    if (!haveSelectedCompany() && isAuthenticated()) {
      // Legacy: dialog.open(SelectCompanyComponent, { disableClose: true, ... })
      this.openSelectCompanyModal()
    }
  }

  openSelectCompanyModal() {
    const modalElement = document.querySelector('[data-controller~="select-company"]')
    if (!modalElement) return

    // Esperar a que Stimulus conecte el controller del modal
    requestAnimationFrame(() => {
      const controller = this.application.getControllerForElementAndIdentifier(modalElement, "select-company")
      if (controller) {
        controller.open()
      } else {
        setTimeout(() => this.openSelectCompanyModal(), 50)
      }
    })
  }

  renderCurrentDate() {
    if (!this.hasCurrentDateTarget) return
    // Legacy: {{currentDate | date:'yyyy-MM-dd'}}
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    this.currentDateTarget.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }
}
