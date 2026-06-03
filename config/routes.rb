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

  # Legacy Angular: path '' → redirectTo '/Home'
  root to: redirect("/Home")
end
