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

  connect() {
    this.validateSession()
    this.renderCurrentDate()
  }

  validateSession() {
    const session = getSession()

    if (!session) {
      // Legacy: deleteStorage('CurrentSession') + navigate /Login
      logout()
      return
    }

    if (!haveSelectedCompany() && isAuthenticated()) {
      // TODO(migrate SelectCompany): abrir el modal SelectCompanyComponent
      // (dialog.open(SelectCompanyComponent, { disableClose: true, ... }))
      console.warn("[Home] SelectCompany modal pendiente de migración (migrate SelectCompany)")
    }
  }

  renderCurrentDate() {
    if (!this.hasCurrentDateTarget) return
    // Legacy: {{currentDate | date:'yyyy-MM-dd'}}
    const now = new Date()
    const pad = (n) => String(n).padStart(2, "0")
    this.currentDateTarget.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }
}
