import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "lib/api_helpers"
import { getError } from "vendor/clavisco/core"
import { error as toastError } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * ChartsConfig (listado) — réplica de ChartsConfigComponent del Angular PMS.
 * Análisis: docs/migration/comparisons/CHARTS-CONFIG-COMPLETE-ANALYSIS.md
 *
 * Administración de gráficos del tablero (ruta /Dashboard):
 *   - GET /api/Chart/GetChartsConfiguration → tabla (Titulo, Tipo, Vista BD, Activo).
 *   - Búsqueda local por Título (debounce 350ms).
 *   - "Nuevo" → /Dashboard/new ; "Editar" → /Dashboard/:id/edit (rutas, no modal).
 */
export default class extends Controller {
  static targets = [
    "searchInput", "tableBody", "emptyState",
    "pageSize", "pageInfo", "prevPage", "nextPage"
  ]

  // Legacy: getIconForChartType
  static TYPE_ICONS = {
    pie: { icon: "pie_chart", color: "#1b81be" },
    bar: { icon: "bar_chart", color: "#1b81be" },
    line: { icon: "show_chart", color: "#1b81be" }
  }
  static DEFAULT_TYPE_ICON = { icon: "insert_chart", color: "#1b81be" }
  // Legacy TableIcons.Enabled / Disabled
  static ACTIVE_ICONS = {
    enabled: { icon: "check_circle", color: "#58d68d" },
    disabled: { icon: "cancel", color: "#ec7063" }
  }

  connect() {
    this.chartsList = []
    this.filteredCharts = []
    this.currentPage = 1
    this.itemsPerPage = 10 // legacy itemsPeerPage default
    this.searchDebounce = null
    this.getCharts()
  }

  // ==========================================================
  // CARGA (legacy getCharts → GetChartsConfiguration)
  // ==========================================================
  async getCharts() {
    showLoading()
    try {
      const { ok, body } = await apiFetch("/api/Chart/GetChartsConfiguration")
      // Legacy: en error la lista queda vacía (catchError → [])
      this.chartsList = ok ? body?.Data || [] : []
    } catch (err) {
      this.chartsList = []
      toastError(getError(err))
    } finally {
      hideLoading()
    }
    this.filteredCharts = [...this.chartsList]
    this.currentPage = 1
    this.renderTable()
  }

  // ==========================================================
  // BÚSQUEDA local por Título (debounce 350ms)
  // ==========================================================
  onSearchInput() {
    clearTimeout(this.searchDebounce)
    this.searchDebounce = setTimeout(() => this.onSearchSetting(this.searchInputTarget.value), 350)
  }

  onSearchClick() {
    this.onSearchSetting(this.searchInputTarget.value)
  }

  onSearchSetting(criteria) {
    // Legacy FilterCharts: Title.toLowerCase().includes(criterio.toLowerCase())
    const lower = (criteria || "").toLowerCase()
    this.filteredCharts = this.chartsList.filter((c) => (c.Title || "").toLowerCase().includes(lower))
    this.currentPage = 1
    this.renderTable()
  }

  // ==========================================================
  // PAGINACIÓN local (10/20/50)
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
    return Math.max(1, Math.ceil(this.filteredCharts.length / this.itemsPerPage))
  }

  // ==========================================================
  // RENDER
  // ==========================================================
  renderTable() {
    const start = (this.currentPage - 1) * this.itemsPerPage
    const pageRecords = this.filteredCharts.slice(start, start + this.itemsPerPage)

    this.tableBodyTarget.innerHTML = ""
    this.emptyStateTarget.hidden = this.filteredCharts.length !== 0

    pageRecords.forEach((chart) => {
      const tr = document.createElement("tr")
      tr.className = "border-b hover:bg-gray-50"

      // Titulo
      const tdTitle = document.createElement("td")
      tdTitle.className = "px-4 py-2"
      tdTitle.textContent = chart.Title ?? ""

      // Tipo (ícono + tooltip "{type} Chart")
      const tdType = document.createElement("td")
      tdType.className = "px-4 py-2"
      tdType.appendChild(this.buildIcon(this.typeIcon(chart.Type), `${(chart.Type || "").toLowerCase()} Chart`))

      // Vista de base de datos (XAxisDatasets)
      const tdView = document.createElement("td")
      tdView.className = "px-4 py-2"
      tdView.textContent = chart.XAxisDatasets ?? ""

      // Activo (ícono enabled/disabled)
      const tdActive = document.createElement("td")
      tdActive.className = "px-4 py-2"
      const activeIcon = chart.IsActive
        ? this.constructor.ACTIVE_ICONS.enabled
        : this.constructor.ACTIVE_ICONS.disabled
      tdActive.appendChild(this.buildIcon(activeIcon))

      // Acciones: Editar → ruta edit
      const tdActions = document.createElement("td")
      tdActions.className = "px-4 py-2 text-right"
      const editLink = document.createElement("a")
      editLink.href = `/Dashboard/${chart.Id}/edit`
      editLink.title = "Editar"
      editLink.className = "inline-flex items-center text-blue-600 hover:text-blue-800"
      editLink.dataset.role = "edit-chart"
      const editIcon = document.createElement("span")
      editIcon.className = "material-icons text-base"
      editIcon.textContent = "edit"
      editLink.appendChild(editIcon)
      tdActions.appendChild(editLink)

      tr.append(tdTitle, tdType, tdView, tdActive, tdActions)
      this.tableBodyTarget.appendChild(tr)
    })

    const total = this.filteredCharts.length
    const end = Math.min(start + this.itemsPerPage, total)
    this.pageInfoTarget.textContent = total === 0 ? "0 de 0" : `${start + 1} - ${end} de ${total}`
    this.prevPageTarget.disabled = this.currentPage <= 1
    this.nextPageTarget.disabled = this.currentPage >= this.totalPages()
  }

  typeIcon(type) {
    return this.constructor.TYPE_ICONS[(type || "").toLowerCase()] || this.constructor.DEFAULT_TYPE_ICON
  }

  buildIcon({ icon, color }, tooltip = "") {
    const span = document.createElement("span")
    span.className = "material-icons"
    span.style.color = color
    span.textContent = icon
    if (tooltip) span.title = tooltip
    return span
  }
}
