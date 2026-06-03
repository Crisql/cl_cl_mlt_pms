import { Controller } from "@hotwired/stimulus"
import { apiFetch, getCurrentCompany, setCurrentCompany } from "lib/api_helpers"
import { logout as guardLogout } from "lib/guards"
import { updateSessionLicence } from "lib/cryptography"
import { Storage, getError } from "vendor/clavisco/core"
import { success as toastSuccess, warning as toastWarning, error as toastError, showAlert } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * SelectCompany — réplica del SelectCompanyComponent del Angular PMS.
 * Análisis completo: docs/migration/comparisons/SELECTCOMPANY-COMPLETE-ANALYSIS.md
 *
 * Modal sobre Home (disableClose). Carga compañías (cache ListCompanies o
 * GET Company/GetCompaniesByUser), select de proceso (HTH/TXT), búsqueda local,
 * tabla paginada local (5/10/15), selección con validaciones de proceso y
 * efectos de storage idénticos al legacy.
 */
export default class extends Controller {
  static targets = [
    "modal", "processSelect", "searchInput", "tableBody",
    "pageSize", "pageInfo", "prevPage", "nextPage", "cancelButton"
  ]

  connect() {
    this.companiesList = []
    this.filteredCompanies = []
    this.currentPage = 1
    this.itemsPerPage = 5
    this.processTypes = []
    this.hasSelectedCompany = false
    this.searchDebounce = null
  }

  // ==========================================================
  // APERTURA / CIERRE
  // ==========================================================

  /** Abre el modal (legacy: dialog.open desde Home.OpenDialog) */
  open() {
    // Legacy: hasSelectedCompany = !!GetCurrentCompany() (antes de cambiarla)
    this.hasSelectedCompany = !!getCurrentCompany()
    this.cancelButtonTarget.hidden = !this.hasSelectedCompany

    this.modalTarget.classList.remove("hidden")
    this.modalTarget.classList.add("flex")

    this.loadInitialData()
  }

  hide() {
    this.modalTarget.classList.add("hidden")
    this.modalTarget.classList.remove("flex")
  }

  /** Legacy CloseThisModal(pCanceledAction) */
  async closeThisModal(canceledAction) {
    if (this.selectedCompany) {
      await this.getMenu()
    }
    this.hide()
  }

  /** Botón Cancelar (solo visible si ya había compañía) */
  cancel() {
    this.closeThisModal(true)
  }

  /** Botón Cerrar Sesión (legacy: authService.Logout() + /Login) */
  logout() {
    guardLogout()
  }

  // ==========================================================
  // CARGA INICIAL (legacy LoadInitialData)
  // ==========================================================

  async loadInitialData() {
    // Legacy: CompaniesList = GetStorageCompanies() ('ListCompanies' base64)
    this.companiesList = Storage.get("ListCompanies") || []

    showLoading("Obteniendo compañias asignadas")

    try {
      // Legacy: GET assets/data/typesCompanyProcess.json → filtra id != 'A'
      const processResponse = await fetch("/assets/data/typesCompanyProcess.json")
      const allProcesses = await processResponse.json()
      this.processTypes = (allProcesses || []).filter((x) => x.id !== "A")
      this.populateProcessSelect()

      // Legacy: si hay cache usa cache, si no GET api/Company/GetCompaniesByUser
      let companies = this.companiesList
      if (!companies || companies.length === 0) {
        const { ok, body } = await apiFetch("/api/Company/GetCompaniesByUser")
        companies = ok ? body?.Data || [] : []
      }

      if (!companies || companies.length === 0) {
        toastWarning("No cuenta con compañías asignadas, contacte al administrador")
        return
      }

      // Legacy: ProcessName = H→HTH, T→TXT, default Todos
      this.companiesList = companies.map((x) => ({ ...x, ProcessName: this.getProcessName(x.Process) }))
      this.filteredCompanies = this.companiesList
      this.currentPage = 1

      // Legacy: SetStorageCompanies → 'ListCompanies' (base64)
      Storage.set("ListCompanies", this.companiesList)

      this.renderTable()
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
    }
  }

  getProcessName(process) {
    switch (process) {
      case "H": return "HTH"
      case "T": return "TXT"
      default: return "Todos"
    }
  }

  populateProcessSelect() {
    const select = this.processSelectTarget
    select.innerHTML = '<option value=""></option>'
    this.processTypes.forEach((p) => {
      const option = document.createElement("option")
      option.value = p.id
      option.textContent = p.name
      select.appendChild(option)
    })
  }

  // ==========================================================
  // BÚSQUEDA (legacy OnSearchCompany / FilterCompanies, debounce 350ms)
  // ==========================================================

  onSearchInput() {
    clearTimeout(this.searchDebounce)
    this.searchDebounce = setTimeout(() => this.onSearchCompany(this.searchInputTarget.value), 350)
  }

  onSearchClick() {
    this.onSearchCompany(this.searchInputTarget.value)
  }

  onSearchCompany(criteria) {
    // Legacy: (Name + DatabaseCode).toLowerCase().includes(criterio)
    const lower = (criteria || "").toLowerCase()
    this.filteredCompanies = this.companiesList.filter((c) =>
      (`${c.Name}${c.DatabaseCode}`).toLowerCase().includes(lower)
    )
    this.currentPage = 1
    this.renderTable()
  }

  // ==========================================================
  // TABLA + PAGINACIÓN LOCAL (5/10/15, default 5)
  // ==========================================================

  onPageSizeChange() {
    this.itemsPerPage = parseInt(this.pageSizeTarget.value, 10)
    this.currentPage = 1
    this.renderTable()
  }

  previousPage() {
    if (this.currentPage > 1) {
      this.currentPage--
      this.renderTable()
    }
  }

  nextPage() {
    if (this.currentPage < this.totalPages()) {
      this.currentPage++
      this.renderTable()
    }
  }

  totalPages() {
    return Math.max(1, Math.ceil(this.filteredCompanies.length / this.itemsPerPage))
  }

  renderTable() {
    const start = (this.currentPage - 1) * this.itemsPerPage
    const pageRecords = this.filteredCompanies.slice(start, start + this.itemsPerPage)

    this.tableBodyTarget.innerHTML = ""
    pageRecords.forEach((company) => {
      const tr = document.createElement("tr")
      tr.className = "border-t hover:bg-gray-50"
      tr.innerHTML = `
        <td class="px-4 py-2"></td>
        <td class="px-4 py-2"></td>
        <td class="px-4 py-2"></td>
        <td class="px-4 py-2 text-right">
          <button type="button" class="text-blue-600 hover:text-blue-800 text-lg" title="Seleccionar" data-role="select-company-row">→</button>
        </td>
      `
      tr.children[0].textContent = company.Name ?? ""
      tr.children[1].textContent = company.DatabaseCode ?? ""
      tr.children[2].textContent = company.ProcessName ?? ""
      tr.querySelector('[data-role="select-company-row"]').addEventListener("click", () => this.selectCompany(company))
      this.tableBodyTarget.appendChild(tr)
    })

    // Info de paginación: "1 - 5 de 12"
    const total = this.filteredCompanies.length
    const end = Math.min(start + this.itemsPerPage, total)
    this.pageInfoTarget.textContent = total === 0 ? "0 de 0" : `${start + 1} - ${end} de ${total}`
    this.prevPageTarget.disabled = this.currentPage <= 1
    this.nextPageTarget.disabled = this.currentPage >= this.totalPages()
  }

  // ==========================================================
  // SELECCIÓN (legacy SelectCompany)
  // ==========================================================

  async selectCompany(company) {
    this.selectedCompany = company
    const processValue = this.processSelectTarget.value

    // Validación 1: Process 'A' requiere proceso seleccionado
    if (company.Process === "A" && processValue === "") {
      await showAlert({ type: "info", title: "Proceso requerido", message: "Primero debe seleccionar un proceso." })
      return
    }

    // Legacy: si select vacío toma el proceso de la compañía
    if (processValue === "") {
      this.processSelectTarget.value = company.Process
    }

    // Validación 2: compañía sin el proceso seleccionado
    if (company.Process !== "A" && this.processSelectTarget.value !== company.Process) {
      await showAlert({ type: "info", title: "Proceso no habilitado", message: "La compañía no cuenta con el proceso seleccionado." })
      return
    }

    // Legacy: selectProcess = nombre del proceso elegido (HTH/TXT)
    this.selectProcess = this.processTypes.find((x) => String(x.id) === this.processSelectTarget.value)?.name ?? ""

    // Efectos de storage (orden exacto del legacy)
    sessionStorage.removeItem("SelectedCompany")
    Storage.remove("RoleAccess")
    Storage.remove("KeyMenu")
    sessionStorage.setItem("Process", JSON.stringify(this.selectProcess))

    this.assignPermissionsByCompany(company)

    // Legacy: el toast se muestra INMEDIATAMENTE (no espera el async) — espaciado literal
    toastSuccess(`Se encuentra trabajando con la compañía ${company.Name}  y el proceso ${this.selectProcess} `)
  }

  /** Legacy AssignPermissionsByCompany */
  async assignPermissionsByCompany(company) {
    showLoading()
    setCurrentCompany(company) // a partir de aquí los requests llevan cl-company-id

    try {
      // GET api/UsersByCompany/GetPermissionsRoles → RoleAccess (base64)
      const permsResponse = await apiFetch("/api/UsersByCompany/GetPermissionsRoles")
      if (permsResponse.ok) {
        const data = permsResponse.body?.Data || {}
        const permissions = data.Permissions || []
        const roles = data.Roles || []
        const permissionsRole = { Roles: roles, Access: permissions.map((x) => x.Name) }
        Storage.set("RoleAccess", permissionsRole)
      }

      // GET api/Users/GetLoggedUser → enriquecer SelectedCompany + Licence
      const userResponse = await apiFetch("/api/Users/GetLoggedUser")

      if (userResponse.ok) {
        const user = userResponse.body?.Data
        if (user) {
          if (user.MainCurrency) this.selectedCompany.MainCurrency = user.MainCurrency
          if (user.TaxIdNum) this.selectedCompany.TaxIdNum = user.TaxIdNum
          this.selectedCompany.ListConfHTH = user.ListConfHTH ?? []
          setCurrentCompany(this.selectedCompany)

          // Legacy: CurrentSession.Licence = AES(SapUser)
          await updateSessionLicence(user.SapUser || "")

          await this.validateProcessConfigured()
        }
        hideLoading()
        this.closeThisModal(false)
      } else if (userResponse.status === 401) {
        // Legacy: menú restringido (home/settings + logout), cerrar, /Home
        hideLoading()
        await this.getRestrictedMenu()
        this.hide()
        window.location.href = "/Home"
      } else {
        console.error("Error loading profile:", userResponse.body)
        setCurrentCompany(this.selectedCompany)
        hideLoading()
        this.closeThisModal(false)
      }
    } catch (err) {
      // Diferencia documentada: el legacy deja el overlay activo ante error de
      // red en GetPermissionsRoles (sin error handler); aquí lo cerramos.
      console.error(err)
      hideLoading()
    }
  }

  /** Legacy ValidateProcessConfigured */
  async validateProcessConfigured() {
    const hthConfigs = this.selectedCompany.ListConfHTH ?? []
    const configTxt = this.selectedCompany.ConfigTXT
    const hasValidTxt = this.selectProcess === "TXT" && this.isValidJSON(configTxt) && configTxt?.length > 0
    const hasValidHth = this.selectProcess === "HTH" && hthConfigs.length > 0

    if (!hasValidTxt && !hasValidHth) {
      await showAlert({ type: "info", title: "Proceso no configurado", message: "El proceso seleccionado para esta compañía no ha sido configurado." })
      window.location.href = "/ConfigProcess"
    }
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
  // MENÚ (legacy GetMenu / GetRestrictedMenu) → KeyMenu (base64)
  // ==========================================================

  static LOGOUT_MENU_OPTION = {
    Icon: "logout",
    Key: "logout",
    Nodes: [],
    Description: "Cerrar Sesión",
    Permission: "",
    Route: "Logout",
    Visible: true
  }

  async getMenu() {
    let menuNodes = []
    try {
      const { ok, body } = await apiFetch("/api/Menu")
      menuNodes = ok ? body?.Data || [] : []
    } catch {
      menuNodes = []
    }

    if (!menuNodes.some((o) => o.Key === this.constructor.LOGOUT_MENU_OPTION.Key)) {
      menuNodes.push(this.constructor.LOGOUT_MENU_OPTION)
    }

    Storage.set("KeyMenu", menuNodes)
  }

  async getRestrictedMenu() {
    const ALLOWED_KEYS = ["home", "settings"]
    let menuNodes = []
    try {
      const { ok, body } = await apiFetch("/api/Menu")
      menuNodes = ok ? body?.Data || [] : []
    } catch {
      menuNodes = []
    }

    menuNodes = menuNodes.filter((node) => ALLOWED_KEYS.includes(node.Key))

    if (!menuNodes.some((o) => o.Key === this.constructor.LOGOUT_MENU_OPTION.Key)) {
      menuNodes.push(this.constructor.LOGOUT_MENU_OPTION)
    }

    Storage.set("KeyMenu", menuNodes)
  }
}
