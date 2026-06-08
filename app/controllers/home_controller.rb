# frozen_string_literal: true

# Home page (legacy Angular route: /Home → HomeComponent).
# Rails only renders the view; session validation and the
# SelectCompany modal trigger live in the home Stimulus controller.
class HomeController < ApplicationController
  layout "authenticated"

  def index
  end
end
