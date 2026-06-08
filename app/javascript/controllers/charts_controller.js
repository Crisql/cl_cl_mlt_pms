import { Controller } from "@hotwired/stimulus"
import Chart from "chart.js"
import { apiFetch } from "lib/api_helpers"

// Exponer Chart globalmente (debug + inspección en pruebas E2E)
window.Chart = Chart
import { haveSelectedCompany } from "lib/auth"
import { showAlert } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * Charts (dashboard de Home) — réplica de ChartsComponent del Angular PMS.
 * Análisis completo: docs/migration/comparisons/HOME-COMPLETE-ANALYSIS.md
 *
 * - Carga GET /api/Chart SOLO si hay compañía seleccionada
 * - Re-fetch cuando SelectCompany cierra con compañía (evento pms:company-changed,
 *   equivalente al observable globalService.company del legacy)
 * - Filtro IsActive, manejo "Sin datos", options JSON.parse, render chart.js
 */
export default class extends Controller {
  static targets = ["grid"]

  connect() {
    this.renderedCharts = []

    // Legacy: suscripción a globalService.company → re-fetch
    this.companyChangedHandler = () => this.getCharts()
    window.addEventListener("pms:company-changed", this.companyChangedHandler)

    // Legacy ngOnInit: solo si HaveSelectedCompany()
    if (haveSelectedCompany()) {
      this.getCharts()
    }
  }

  disconnect() {
    window.removeEventListener("pms:company-changed", this.companyChangedHandler)
    this.destroyCharts()
  }

  destroyCharts() {
    this.renderedCharts.forEach((c) => c.destroy())
    this.renderedCharts = []
  }

  /** Legacy GetCharts() */
  async getCharts() {
    showLoading("Cargando tablero principal")

    try {
      const { ok, body } = await apiFetch("/api/Chart")

      if (!ok || !body) return // legacy: catchError → lista vacía, sin modal

      // Legacy: Message no vacío → modal ERROR con detalle de charts con error
      if (body.Message && body.Message.length > 0) {
        const detail = (body.Data || [])
          .filter((chart) => chart.ErrorMessage != null)
          .map((chart) => `${chart.Title}: ${chart.ErrorMessage}`)
          .join(", ")
        showAlert({ type: "error", title: body.Message, message: detail })
      }

      const chartsData = (body.Data || []).filter((chart) => chart.IsActive)
      this.renderCharts(chartsData)
    } catch (_err) {
      // legacy: catchError(() => []) — silencioso
    } finally {
      hideLoading()
    }
  }

  renderCharts(chartsData) {
    this.destroyCharts()
    this.gridTarget.innerHTML = ""

    chartsData.forEach((chart, index) => {
      // Legacy: labels vacíos → 'Sin datos' con data [1]
      if (chart.Data?.labels?.length === 0) {
        chart.Data.labels.push("Sin datos")
        chart.Data.datasets?.forEach((dataset) => {
          dataset.data?.push(1)
          dataset.label = "Sin datos"
        })
      }

      const card = document.createElement("div")
      card.className = "bg-white border rounded-lg shadow-sm p-4 m-2 w-full md:w-[48%] lg:w-[23%]"
      card.innerHTML = `
        <span class="font-medium text-gray-800" data-role="chart-title"></span>
        <hr class="my-2" />
        <canvas id="chart-label-${index}" class="chart-canvas"></canvas>
      `
      card.querySelector('[data-role="chart-title"]').textContent = chart.Title ?? ""
      this.gridTarget.appendChild(card)

      // Legacy: {type, data, options: JSON.parse(chart.Options)}
      let options = {}
      try {
        options = chart.Options ? JSON.parse(chart.Options) : {}
      } catch (_e) {
        options = {}
      }

      const canvas = card.querySelector("canvas")
      this.renderedCharts.push(new Chart(canvas, { type: chart.Type, data: chart.Data, options }))
    })
  }
}
