# frozen_string_literal: true

# Dashboard / administración de gráficos del tablero
# (legacy Angular: /Dashboard → ChartsConfigComponent + ModalChartConfigComponent).
#
# Rails solo renderiza las vistas; toda la lógica (API vía /api/Chart, validaciones,
# armado del IChartContext) vive en los controllers Stimulus charts_config y
# chart_config_form. El modal del legacy se reemplaza por las rutas new/edit.
class ChartsConfigController < ApplicationController
  layout "authenticated"

  # GET /Dashboard — listado de gráficos
  def index
  end

  # GET /Dashboard/new  y  GET /Dashboard/:id/edit — formulario (crear/editar)
  def form
    @chart_id = params[:id]
  end
end
