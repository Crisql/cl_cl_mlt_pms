# Pin npm packages by running ./bin/importmap

pin "application"
pin "@hotwired/turbo-rails", to: "turbo.min.js"
pin "@hotwired/stimulus", to: "stimulus.min.js"
pin "@hotwired/stimulus-loading", to: "stimulus-loading.js"
pin_all_from "app/javascript/controllers", under: "controllers"

# PMS lib modules - shared helpers (session, headers, guards)
pin_all_from "app/javascript/lib", under: "lib"

# @clavisco vendor modules (JS ports of the Angular @clavisco/* libraries)
pin_all_from "app/javascript/vendor/clavisco", under: "vendor/clavisco"
pin "vendor/clavisco/core", to: "vendor/clavisco/core/index.js"

# chart.js 4.4 (misma versión que el Angular legacy) — bundle auto-registrado
pin "chart.js", to: "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/auto/+esm"
