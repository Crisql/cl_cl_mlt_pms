import { Controller } from "@hotwired/stimulus"
import { apiFetch } from "lib/api_helpers"
import { getError } from "vendor/clavisco/core"
import { success as toastSuccess, warning as toastWarning, error as toastError, confirm as confirmDialog } from "vendor/clavisco/alerts"
import { showLoading, hideLoading } from "vendor/clavisco/overlay"

/**
 * ChartConfigForm — réplica de ModalChartConfigComponent del Angular PMS,
 * convertido de modal a página (rutas /Dashboard/new y /Dashboard/:id/edit).
 * Análisis: docs/migration/comparisons/CHARTS-CONFIG-COMPLETE-ANALYSIS.md
 *
 * Mantiene contrato API y validaciones idénticos al legacy:
 *   - Carga: ChartType/dataType/optionsForCharts (assets locales) + GetChartsColorRanges
 *     y, en edición, GetChartsLabelsByChartId + re-hidratación del IChart vía
 *     GetChartsConfiguration (no existe GET-by-id; mismo endpoint del listado).
 *   - Guardar: POST /api/Chart (crear) o PATCH /api/Chart (editar) con IChartContext.
 */
export default class extends Controller {
  static targets = [
    "title", "tabGraphBtn", "tabLabelsBtn", "graphTab", "labelsTab",
    "fTitle", "fType", "fOptions", "fXType", "fYType", "fXAxisDatasets", "fIsActive",
    "errTitle", "errType", "optionsList",
    "fXAxis", "fHaveDynamicLabels", "manualBlock", "colorsContainer",
    "dynamicBlock", "fChartColorRange", "rangePreview",
    "saveButton"
  ]

  static values = {
    chartId: String
  }

  static HEX_RE = /^#[0-9A-F]{6}$/i

  connect() {
    this.isEditing = !!this.chartIdValue
    this.chartRecord = null   // IChart en edición (re-hidratado)
    this.chartLabels = []     // IChartLabels[] en edición
    this.chartColorRanges = []
    this.titleTarget.textContent = this.isEditing ? "Modificar datos del gráfico" : "Datos del gráfico"
    this.getInitialData()
    this.validate()
  }

  // ==========================================================
  // CARGA INICIAL (legacy GetInitialData / forkJoin)
  // ==========================================================
  async getInitialData() {
    showLoading()
    try {
      const [chartTypes, dataTypes, options, colorRanges, labelsResp, chartRecord] = await Promise.all([
        this.fetchAsset("/assets/data/ChartType.json"),
        this.fetchAsset("/assets/data/dataType.json"),
        this.fetchAsset("/assets/data/optionsForCharts.json"),
        apiFetch("/api/Chart/GetChartsColorRanges").catch(() => null),
        this.isEditing
          ? apiFetch(`/api/Chart/GetChartsLabelsByChartId?Id=${this.chartIdValue}`).catch(() => null)
          : Promise.resolve(null),
        // Adaptación MPA: el modal recibía el IChart; aquí se re-hidrata desde el listado.
        this.isEditing ? apiFetch("/api/Chart/GetChartsConfiguration").catch(() => null) : Promise.resolve(null)
      ])

      this.populateEnumSelect(this.fTypeTarget, chartTypes || [])
      this.populateEnumSelect(this.fXTypeTarget, dataTypes || [])
      this.populateEnumSelect(this.fYTypeTarget, dataTypes || [])
      this.populateOptionsList(options || [])

      if (colorRanges?.ok && colorRanges.body?.Data) {
        this.chartColorRanges = colorRanges.body.Data
        this.checkColorRanges(this.chartColorRanges)
        this.populateColorRangeSelect(this.chartColorRanges)
      }

      if (this.isEditing) {
        // IChart de la fila (re-hidratado)
        const list = chartRecord?.ok ? chartRecord.body?.Data || [] : []
        this.chartRecord = list.find((c) => String(c.Id) === String(this.chartIdValue)) || null
        if (this.chartRecord) this.patchChart(this.chartRecord)

        if (labelsResp?.ok && labelsResp.body?.Data && labelsResp.body.Data.length > 0) {
          this.chartLabels = labelsResp.body.Data
          this.patchLabels()
        }
      }
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
      this.validate()
    }
  }

  async fetchAsset(url) {
    try {
      const res = await fetch(url)
      return res.ok ? await res.json() : []
    } catch {
      return []
    }
  }

  populateEnumSelect(select, items) {
    // conserva el placeholder vacío inicial
    items.forEach((it) => {
      const opt = document.createElement("option")
      opt.value = it.id
      opt.textContent = it.name
      select.appendChild(opt)
    })
  }

  populateOptionsList(items) {
    this.optionsListTarget.innerHTML = ""
    items.forEach((it) => {
      const opt = document.createElement("option")
      opt.value = it.id // el autocomplete del legacy sugiere option.id
      this.optionsListTarget.appendChild(opt)
    })
  }

  // ==========================================================
  // EDICIÓN: patch del IChart y de los labels
  // ==========================================================
  patchChart(chart) {
    this.fTitleTarget.value = chart.Title ?? ""
    this.fTypeTarget.value = chart.Type ?? ""
    this.fOptionsTarget.value = chart.Options ?? ""
    this.fXTypeTarget.value = chart.XType ?? ""
    this.fYTypeTarget.value = chart.YType ?? ""
    this.fXAxisDatasetsTarget.value = chart.XAxisDatasets ?? ""
    this.fIsActiveTarget.checked = !!chart.IsActive
  }

  patchLabels() {
    const chartLabel = this.chartLabels[0]
    this.fHaveDynamicLabelsTarget.checked = !!chartLabel.HaveDynamicLabels
    this.fXAxisTarget.value = chartLabel.XAxis ?? ""

    let labels = []
    try { labels = JSON.parse(chartLabel.Labels) } catch { labels = [] }

    if (chartLabel.HaveDynamicLabels) {
      this.fChartColorRangeTarget.value = chartLabel.ChartColorRange ?? ""
      this.applyDynamicMode(true)
      this.updateRangePreview()
    } else {
      let colors = []
      try { colors = JSON.parse(chartLabel.Colors) } catch { colors = [] }
      this.clearColors()
      colors.forEach((color, i) => this.addColorRow(labels[i] ?? "", color))
      this.applyDynamicMode(false)
    }
  }

  // ==========================================================
  // PESTAÑAS
  // ==========================================================
  showGraphTab() {
    this.graphTabTarget.hidden = false
    this.labelsTabTarget.hidden = true
    this.setActiveTab(this.tabGraphBtnTarget, this.tabLabelsBtnTarget)
  }

  showLabelsTab() {
    this.graphTabTarget.hidden = true
    this.labelsTabTarget.hidden = false
    this.setActiveTab(this.tabLabelsBtnTarget, this.tabGraphBtnTarget)
  }

  setActiveTab(active, inactive) {
    active.classList.add("border-blue-600", "text-blue-600")
    active.classList.remove("border-transparent", "text-gray-500")
    inactive.classList.add("border-transparent", "text-gray-500")
    inactive.classList.remove("border-blue-600", "text-blue-600")
  }

  // ==========================================================
  // LABELS DINÁMICOS (toggle)
  // ==========================================================
  async askToChangeDynamicLabels() {
    const isChecked = this.fHaveDynamicLabelsTarget.checked

    if (isChecked && this.colorRows().length > 0) {
      const ok = await confirmDialog(
        "Al cambiar a label dinámicos se perderá el nombre de los labels ya creados. ¿Desea continuar?",
        "Aviso"
      )
      if (ok) {
        this.onSlideToggleChange()
      } else {
        // Corrección documentada vs legacy: al cancelar se revierte el toggle
        // (el legacy quedaba en estado inconsistente: checkbox on, modo manual).
        this.fHaveDynamicLabelsTarget.checked = false
      }
    } else {
      this.onSlideToggleChange()
    }
  }

  onSlideToggleChange() {
    const isChecked = this.fHaveDynamicLabelsTarget.checked
    if (!isChecked) {
      // Legacy: Colors → FormArray([]) (se limpian las filas previas)
      this.clearColors()
    }
    this.applyDynamicMode(isChecked)
    this.validate()
  }

  applyDynamicMode(isDynamic) {
    this.manualBlockTarget.hidden = isDynamic
    this.dynamicBlockTarget.hidden = !isDynamic
  }

  // ==========================================================
  // FILAS DE COLOR (modo manual)
  // ==========================================================
  colorRows() {
    return Array.from(this.colorsContainerTarget.querySelectorAll("[data-role='color-row']"))
  }

  clearColors() {
    this.colorsContainerTarget.innerHTML = ""
  }

  addColor() {
    // Legacy: en manual el nombre va vacío (HaveDynamicLabels=false)
    this.addColorRow("", "#000000")
    this.validate()
  }

  addColorRow(labelName, color) {
    const row = document.createElement("div")
    row.dataset.role = "color-row"
    row.className = "flex items-end gap-2"
    row.innerHTML = `
      <div class="flex-1">
        <label class="block text-xs text-gray-500 mb-1">Label</label>
        <input type="text" data-role="label-input" placeholder="Label"
               class="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
      </div>
      <div>
        <label class="block text-xs text-gray-500 mb-1">Color</label>
        <input type="color" data-role="color-input"
               class="h-9 w-14 border border-gray-300 rounded" />
      </div>
      <button type="button" data-role="remove-color" title="Eliminar"
              class="p-2 text-blue-600 hover:text-blue-800">
        <span class="material-icons">delete</span>
      </button>
    `
    row.querySelector("[data-role='label-input']").value = labelName ?? ""
    row.querySelector("[data-role='color-input']").value = color ?? "#000000"
    row.querySelector("[data-role='label-input']").addEventListener("input", () => this.validate())
    row.querySelector("[data-role='remove-color']").addEventListener("click", () => {
      row.remove()
      this.validate()
    })
    this.colorsContainerTarget.appendChild(row)
  }

  // ==========================================================
  // RANGOS DE COLOR (modo dinámico)
  // ==========================================================
  isRangeInvalid(rangeColors) {
    try {
      const colors = JSON.parse(rangeColors)
      if (!Array.isArray(colors) || colors.length === 0) return true
      return !colors.every((c) => this.constructor.HEX_RE.test(c))
    } catch {
      return true
    }
  }

  checkColorRanges(colorRanges) {
    const invalid = colorRanges
      .filter((r) => this.isRangeInvalid(r.Colors))
      .map((r) => r.Name)
    if (invalid.length > 0) this.showRangeNotification(invalid)
  }

  // Legacy usa NotificationCenterService; aquí toast (no hay centro de notificaciones).
  showRangeNotification(names) {
    if (names.length === 1) {
      toastError(`El rango ${names[0]} no tiene el formato correcto`)
    } else {
      toastError(`Los rangos ${names.join(", ")} no tienen el formato correcto`)
    }
  }

  populateColorRangeSelect(ranges) {
    ranges
      .filter((r) => !this.isRangeInvalid(r.Colors))
      .forEach((r) => {
        const opt = document.createElement("option")
        opt.value = r.Code
        opt.textContent = r.Name
        this.fChartColorRangeTarget.appendChild(opt)
      })
  }

  updateRangePreview() {
    const code = this.fChartColorRangeTarget.value
    const range = this.chartColorRanges.find((r) => r.Code === code)
    this.rangePreviewTarget.innerHTML = ""
    if (!range) return
    const swatch = document.createElement("div")
    swatch.className = "h-6 w-full rounded border"
    Object.assign(swatch.style, this.gradientStyle(range.Colors, this.checkGradientColors(range.Colors)))
    this.rangePreviewTarget.appendChild(swatch)
  }

  checkGradientColors(rangeColors) {
    try {
      return JSON.parse(rangeColors).length > 1
    } catch {
      return false
    }
  }

  gradientStyle(rangeColors, isGradient) {
    try {
      const colors = JSON.parse(rangeColors)
      if (!isGradient) return { background: colors[0] }
      return { background: `linear-gradient(to right, ${colors.join(", ")})` }
    } catch {
      return {}
    }
  }

  // ==========================================================
  // VALIDACIÓN (legacy IsValidForm / GetTooltipMessage)
  // ==========================================================
  isDynamic() {
    return this.fHaveDynamicLabelsTarget.checked
  }

  chartFormInvalid() {
    return !this.fTitleTarget.value.trim() ||
      !this.fTypeTarget.value ||
      !this.fOptionsTarget.value.trim() ||
      !this.fXTypeTarget.value ||
      !this.fYTypeTarget.value ||
      !this.fXAxisDatasetsTarget.value.trim()
  }

  // formChartLabel.invalid: XAxis required + (manual) cada Label required
  labelFormInvalid() {
    if (!this.fXAxisTarget.value.trim()) return true
    if (!this.isDynamic()) {
      return this.colorRows().some((row) => !row.querySelector("[data-role='label-input']").value.trim())
    }
    return false
  }

  // ColorsFormArray.length == 0 (solo aplica en modo manual; en dinámico es FormControl)
  colorsLenZero() {
    return !this.isDynamic() && this.colorRows().length === 0
  }

  isValidForm() {
    if (this.labelFormInvalid() || this.colorsLenZero()) return false
    if (this.chartFormInvalid()) return false
    return true
  }

  tooltipMessage() {
    if (this.isValidForm()) return ""
    let message = ""
    if (this.labelFormInvalid() || this.colorsLenZero()) {
      message = "Se requiere que se complete la información de los labels"
    }
    if (this.chartFormInvalid()) {
      message = "Formulario no válido"
    }
    return message
  }

  validate() {
    // errores de campo (Titulo / Tipo)
    if (this.hasErrTitleTarget) this.errTitleTarget.hidden = !!this.fTitleTarget.value.trim()
    if (this.hasErrTypeTarget) this.errTypeTarget.hidden = !!this.fTypeTarget.value

    if (this.hasFChartColorRangeTarget && this.isDynamic()) this.updateRangePreview()

    const valid = this.isValidForm()
    this.saveButtonTarget.disabled = !valid
    this.saveButtonTarget.title = this.tooltipMessage()
  }

  // ==========================================================
  // GUARDAR (legacy OnSave / CreateGraph / UpdateGraph)
  // ==========================================================
  onSave() {
    if (this.labelFormInvalid() || this.colorsLenZero()) {
      toastWarning("Se requiere que se complete la información de los labels")
      return
    }
    if (this.isEditing) {
      this.updateGraph()
    } else {
      this.createGraph()
    }
  }

  buildChartContext() {
    const isDynamic = this.isDynamic()
    const rows = this.colorRows()
    const colors = isDynamic ? [] : rows.map((r) => r.querySelector("[data-role='color-input']").value)
    const labels = isDynamic ? [] : rows.map((r) => r.querySelector("[data-role='label-input']").value)

    const chart = {
      Title: this.fTitleTarget.value,
      Type: this.fTypeTarget.value,
      Options: this.fOptionsTarget.value,
      XType: this.fXTypeTarget.value,
      YType: this.fYTypeTarget.value,
      XAxisDatasets: this.fXAxisDatasetsTarget.value,
      IsActive: this.fIsActiveTarget.checked,
      // Legacy: en edición patchValue(data) hereda CreatedBy/UpdatedBy del registro
      CreatedBy: this.isEditing ? (this.chartRecord?.CreatedBy ?? "") : "",
      UpdatedBy: this.isEditing ? (this.chartRecord?.UpdatedBy ?? "") : ""
    }

    const chartLabel = {
      HaveDynamicLabels: isDynamic,
      Colors: JSON.stringify(colors),
      ChartColorRange: this.isDynamic() ? this.fChartColorRangeTarget.value : "",
      Labels: JSON.stringify(labels),
      XAxis: this.fXAxisTarget.value,
      CreatedBy: "",
      UpdatedBy: ""
    }

    return { Chart: chart, ChartLabel: chartLabel }
  }

  async createGraph() {
    showLoading()
    let ok = false
    try {
      const res = await apiFetch("/api/Chart", { method: "POST", body: JSON.stringify(this.buildChartContext()) })
      ok = res.ok && !!res.body
      if (ok) toastSuccess("Creado correctamente")
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
      // Legacy: el modal se cierra en finalize (con o sin éxito) → aquí navega al listado
      this.backToList()
    }
  }

  async updateGraph() {
    showLoading()
    const context = this.buildChartContext()
    context.Chart.Id = this.isEditing ? Number(this.chartIdValue) : undefined
    context.ChartLabel.Id = this.chartLabels.length > 0 ? this.chartLabels[0].Id : 0
    try {
      const res = await apiFetch("/api/Chart", { method: "PATCH", body: JSON.stringify(context) })
      if (res.ok) toastSuccess("Actualizado correctamente")
    } catch (err) {
      toastError(getError(err))
    } finally {
      hideLoading()
      this.backToList()
    }
  }

  backToList() {
    window.location.href = "/Dashboard"
  }
}
