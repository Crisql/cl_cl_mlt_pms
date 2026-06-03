// Configure your import map in config/importmap.rb. Read more: https://github.com/rails/importmap-rails
import "@hotwired/turbo-rails"
import "controllers"
import { initGuards } from "lib/guards"

// Global navigation guards (auth check on Turbo visits)
document.addEventListener("DOMContentLoaded", () => {
  initGuards()
})
