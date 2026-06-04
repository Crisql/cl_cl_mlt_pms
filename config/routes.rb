Rails.application.routes.draw do
  # Reveal health status on /up that returns 200 if the app boots with no exceptions, otherwise 500.
  get "up" => "rails/health#show", as: :rails_health_check

  # Transparent proxy to the legacy .NET PMS API (see Api::ProxyController)
  namespace :api do
    match "*path", to: "proxy#forward", via: :all
  end

  # UI routes mirror the legacy Angular paths EXACTLY (including casing and
  # historical typos like SearchPruchaseOrders / BankFormarts) so that
  # bookmarks and redirectURL params keep working.
  get "Login", to: "sessions#new", as: :login
  get "Home", to: "home#index", as: :home
  get "Home/:UserId", to: "home#index"
  # Legacy: ruta /SelectCompany existe como página; renderiza Home con el modal
  get "SelectCompany", to: "home#index"

  # Dashboard = administración (CRUD) de gráficos del tablero
  # (legacy /Dashboard → ChartsConfigModule). El legacy crea/edita en un modal;
  # aquí se hace por rutas (decisión de diseño acordada con el usuario).
  get "Dashboard", to: "charts_config#index", as: :dashboard
  get "Dashboard/new", to: "charts_config#form", as: :new_chart_config
  get "Dashboard/:id/edit", to: "charts_config#form", as: :edit_chart_config

  # Legacy Angular: path '' → redirectTo '/Home'
  root to: redirect("/Home")
end
