import { Controller } from "@hotwired/stimulus"
import { apiFetch, getSession, getCurrentCompany, getCurrentProcess } from "lib/api_helpers"
import { isAuthenticated } from "lib/auth"
import { logout as guardLogout } from "lib/guards"
import { Storage } from "vendor/clavisco/core"
import { info as toastInfo, warning as toastWarning, showAlert } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * Principal (shell autenticado) — réplica de PagesComponent + cl-menu + HeaderComponent.
 * Análisis completo: docs/migration/comparisons/SHELL-COMPLETE-ANALYSIS.md
 *
 * - Sidebar: árbol de KeyMenu (filtro Visible recursivo, acordeón OnlyOneOpened,
 *   nodo activo por ruta, íconos Material). Route 'Logout' → logout.
 * - Header: Compañía (abre SelectCompany), Tipo de cambio (CanCrossCurrencies),
 *   Usuario (avatar GetLoggedUser), Proceso TXT/HTH con validaciones exactas.
 * - Post-login: LoadSettings (BankAccountsValidFormats + AutoBatchProcessor).
 */
export default class extends Controller {
  static targets = [
    "sidebar", "sidebarOverlay", "menuContainer", "companyLogo", "envTitle",
    "companyName", "exchangeRateButton", "exchangeRate",
    "userAvatar", "userEmail", "processName", "processMenu"
  ]

  static values = {
    envName: { type: String, default: "" }
  }

  static LOGO_DEFAULT = null // se toma del src inicial del <img>

  connect() {
    this.menuOpen = true
    this.logoDefault = this.companyLogoTarget.src
    this.avatarDefault = this.userAvatarTarget.src

    this.envTitleTarget.textContent = this.envNameValue

    // Legacy globalService.company → refrescar logo/encabezado al cambiar compañía
    this.companyChangedHandler = () => this.refreshHeaderInfo()
    window.addEventListener("pms:company-changed", this.companyChangedHandler)

    this.renderMenu()
    this.refreshHeaderInfo()

    if (isAuthenticated()) {
      this.loadProfile()
      this.loadSettings()
    }
  }

  disconnect() {
    window.removeEventListener("pms:company-changed", this.companyChangedHandler)
  }

  // ==========================================================
  // SIDEBAR / MENÚ (cl-menu)
  // ==========================================================

  toggleMenu() {
    this.menuOpen = !this.menuOpen
    this.sidebarTarget.classList.toggle("-translate-x-full", !this.menuOpen)
    this.sidebarTarget.classList.toggle("lg:hidden", !this.menuOpen)
    this.sidebarOverlayTarget.classList.toggle("hidden", !this.menuOpen || window.innerWidth >= 1024)
  }

  /** Legacy FilterVisibleNode: filtro recursivo por Visible */
  filterVisibleNodes(nodes) {
    return (nodes || []).filter((n) => n.Visible).map((n) => ({
      ...n,
      Nodes: this.filterVisibleNodes(n.Nodes)
    }))
  }

  renderMenu() {
    const nodes = this.filterVisibleNodes(Storage.get("KeyMenu") || [])
    this.menuContainerTarget.innerHTML = ""

    if (nodes.length === 0) {
      this.menuContainerTarget.innerHTML = '<div class="text-center text-gray-400 text-sm py-4">Sin opciones de menú</div>'
      return
    }

    const list = this.buildMenuList(nodes, 0)
    this.menuContainerTarget.appendChild(list)
    this.expandActiveParents(nodes)
  }

  buildMenuList(nodes, level) {
    const ul = document.createElement("ul")
    ul.className = level === 0 ? "space-y-1" : "ml-4 space-y-1"

    nodes.forEach((node) => {
      const li = document.createElement("li")
      const hasChildren = node.Nodes && node.Nodes.length > 0
      const isActive = this.isNodeActive(node)

      const item = document.createElement("button")
      item.type = "button"
      item.className = `w-full flex items-center gap-2 px-3 py-2 rounded text-left text-sm ${
        isActive ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
      }`
      item.dataset.menuKey = node.Key

      const icon = document.createElement("span")
      icon.className = "material-icons text-base"
      icon.textContent = node.Icon || ""
      item.appendChild(icon)

      const label = document.createElement("span")
      label.className = "flex-1"
      label.textContent = node.Description
      item.appendChild(label)

      if (hasChildren) {
        const chevron = document.createElement("span")
        chevron.className = "material-icons text-base"
        chevron.textContent = "expand_more"
        item.appendChild(chevron)
      }

      item.addEventListener("click", () => this.executeAction(node, li))
      li.appendChild(item)

      if (hasChildren) {
        const childList = this.buildMenuList(node.Nodes, level + 1)
        childList.hidden = true
        childList.dataset.menuChildren = node.Key
        li.appendChild(childList)
      }

      ul.appendChild(li)
    })

    return ul
  }

  /** Legacy isNodeActive: Route === ruta actual */
  isNodeActive(node) {
    if (!node.Route) return false
    return window.location.pathname === `/${node.Route}` || window.location.pathname === node.Route
  }

  /** Legacy shouldExpandParent: expande padres de nodos activos */
  expandActiveParents(nodes) {
    nodes.forEach((node) => {
      const hasActiveChild = (node.Nodes || []).some(
        (child) => this.isNodeActive(child) || (child.Nodes || []).some((g) => this.isNodeActive(g))
      )
      if (hasActiveChild) {
        const childList = this.menuContainerTarget.querySelector(`[data-menu-children="${node.Key}"]`)
        if (childList) childList.hidden = false
      }
    })
  }

  /** Legacy ExecuteAction + ClickMenuOption */
  executeAction(node, li) {
    const hasChildren = node.Nodes && node.Nodes.length > 0

    if (hasChildren) {
      // OnlyOneOpened: colapsa todos y expande este (acordeón)
      const childList = li.querySelector(`[data-menu-children="${node.Key}"]`)
      const wasHidden = childList.hidden
      this.menuContainerTarget.querySelectorAll("[data-menu-children]").forEach((el) => (el.hidden = true))
      childList.hidden = !wasHidden
    }

    // PagesComponent.ClickMenuOption: Route 'Logout' → logout + /Login
    if (node.Route === "Logout") {
      guardLogout()
      return
    }

    if (node.Route) {
      // Legacy: si ya está en la ruta → toast "Ya se encuentra en X".
      // Adaptación MPA: no se recarga la página (en el SPA la "renavegación"
      // a la misma URL no recargaba y el toast quedaba visible).
      if (this.isNodeActive(node)) {
        toastInfo(`Ya se encuentra en ${node.Description}`)
        return
      }
      window.location.href = `/${node.Route}`
    }
  }

  // ==========================================================
  // HEADER: info de compañía / proceso / logo
  // ==========================================================

  refreshHeaderInfo() {
    const company = getCurrentCompany()
    const process = getCurrentProcess()

    this.companyNameTarget.textContent = company?.Name || ""
    this.processNameTarget.textContent = process || ""

    // Logo: SelectedCompany.Logo base64 (prefijado si falta) o default
    if (company?.Logo) {
      this.companyLogoTarget.src = company.Logo.includes("data:image/png;base64")
        ? company.Logo
        : `data:image/png;base64,${company.Logo}`
    } else {
      this.companyLogoTarget.src = this.logoDefault
    }

    // Tipo de cambio: SOLO visible con CanCrossCurrencies
    this.exchangeRateButtonTarget.hidden = !company?.CanCrossCurrencies
    const cachedRate = sessionStorage.getItem("ExchangeRateBCCR")
    this.exchangeRateTarget.textContent = cachedRate ? JSON.parse(cachedRate) : 0

    // Usuario: email del token (legacy header usa CurrentSession.Email)
    const session = getSession()
    this.userEmailTarget.textContent = session?.Email || session?.UserEmail || ""

    // Avatar cacheado (adaptación MPA — ver análisis)
    const cachedAvatar = sessionStorage.getItem("UserAvatar")
    if (cachedAvatar) this.userAvatarTarget.src = cachedAvatar
  }

  // ==========================================================
  // HEADER: perfil + tipo de cambio (LoadProfile / GetExchangeRateFromBCCR)
  // ==========================================================

  /** Legacy LoadProfile — adaptación MPA: solo si no hay avatar cacheado */
  async loadProfile() {
    if (!getCurrentCompany()) return
    if (sessionStorage.getItem("UserAvatar")) return

    try {
      const { ok, body } = await apiFetch("/api/Users/GetLoggedUser")
      if (ok && body?.Data) {
        this.loggedUser = body.Data
        const profilePicture = body.Data.ProfilePicture
        if (profilePicture) {
          sessionStorage.setItem("UserAvatar", profilePicture)
          this.userAvatarTarget.src = profilePicture
        }
        if (getCurrentCompany()?.CanCrossCurrencies && !sessionStorage.getItem("ExchangeRateBCCR")) {
          await this.fetchExchangeRate()
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  /** Botón refresh — SIEMPRE llama al API (como el legacy) */
  async refreshExchangeRate() {
    showLoading()
    try {
      await this.fetchExchangeRate()
    } finally {
      hideLoading()
    }
  }

  async fetchExchangeRate() {
    try {
      const { ok, body } = await apiFetch("/api/Bank/GetExchangeRateFromBccr")
      const rate = ok && body?.Data ? body.Data : 0
      this.exchangeRateTarget.textContent = rate
      sessionStorage.setItem("ExchangeRateBCCR", JSON.stringify(rate))
    } catch (e) {
      console.error("Error al obtener el tipo de cambio del BCCR:", e)
      this.exchangeRateTarget.textContent = 0
    }
  }

  // ==========================================================
  // HEADER: compañía / usuario / proceso
  // ==========================================================

  /** Legacy header SelectCompany() → abre el modal migrado */
  selectCompany() {
    const modalElement = document.querySelector('[data-controller~="select-company"]')
    if (!modalElement) return
    const controller = this.application.getControllerForElementAndIdentifier(modalElement, "select-company")
    if (controller) controller.open()
  }

  /** Legacy SelectUser(): ModalSAPCredentials (módulo NO migrado) o toast */
  selectUser() {
    if (this.loggedUser) {
      // TODO(migrate SAPCredentials): abrir ModalSAPCredentialsComponent
      console.warn("[Shell] ModalSAPCredentials pendiente de migración (migrate SAPCredentials)")
    } else {
      const session = getSession()
      toastWarning(`No se pudo obtener la información del usuario: ${session?.Email || session?.UserEmail || ""}`)
    }
  }

  toggleProcessMenu() {
    this.processMenuTarget.hidden = !this.processMenuTarget.hidden
  }

  selectProcessTXT() {
    this.processMenuTarget.hidden = true
    this.selectProcess("TXT")
  }

  selectProcessHTH() {
    this.processMenuTarget.hidden = true
    this.selectProcess("HTH")
  }

  /** Legacy SelectProcess(p) — validaciones y flujo EXACTOS (incluye que
   *  'Proceso no configurado' NO aborta: setea el proceso igual) */
  async selectProcess(process) {
    const company = getCurrentCompany()
    if (!company) return

    if (company.Process !== "A" && process !== company.ProcessName) {
      await showAlert({ type: "info", title: "Proceso no habilitado", message: "La compañía no cuenta con el proceso seleccionado." })
      return
    }

    const invalidTxt = process === "TXT" && !this.isValidJSON(company.ConfigTXT)
    const invalidHth = process === "HTH" && (company.ListConfHTH || []).length === 0
    const selectProcessConfig = process === "TXT"
      ? (this.isValidJSON(company.ConfigTXT) ? JSON.parse(company.ConfigTXT) : null)
      : company.ListConfHTH

    if (selectProcessConfig == null || invalidTxt || invalidHth) {
      await showAlert({ type: "info", title: "Proceso no configurado", message: "El proceso seleccionado para esta compañía no ha sido configurado." })
      window.location.href = "/ConfigProcess"
      return
    }

    this.processNameTarget.textContent = process
    sessionStorage.setItem("Process", JSON.stringify(process))
    window.dispatchEvent(new CustomEvent("pms:process-changed"))
  }

  isValidJSON(jsonString) {
    try {
      JSON.parse(jsonString)
      return true
    } catch {
      return false
    }
  }

  // ==========================================================
  // POST-LOGIN: LoadSettings (app.component → GlobalService.LoadSettings)
  // ==========================================================

  /** Adaptación MPA: solo si AutoBatchProcessor aún no está en sessionStorage */
  async loadSettings() {
    if (sessionStorage.getItem("AutoBatchProcessor") !== null) return
    if (!getCurrentCompany()) return

    const [banksAccounts, configsProcess] = await Promise.all([
      apiFetch("/api/Setting/GetSettingByKey?key=BankAccountsValidFormats").catch(() => null),
      apiFetch("/api/Setting/GetSettingByKey?key=AutoBatchProcessor").catch(() => null)
    ])

    if (banksAccounts?.ok && banksAccounts.body?.Data) {
      // Legacy: queda en memoria del GlobalService (_bankAccountsValidFormats)
      try {
        window.pmsBankAccountsValidFormats = JSON.parse(banksAccounts.body.Data.Json || "") ?? []
      } catch { /* legacy: JSON inválido lanza y queda sin setear */ }
    }

    if (configsProcess?.ok && configsProcess.body?.Data) {
      try {
        const autoBatchProcessor = JSON.parse(configsProcess.body.Data.Json) ?? false
        sessionStorage.setItem("AutoBatchProcessor", JSON.stringify(autoBatchProcessor))
      } catch { /* idem */ }
    }
  }
}
