# frozen_string_literal: true

# Login page (legacy Angular route: /Login → LoginContainerComponent).
# Rails only renders the view; the login flow itself lives in the
# login Stimulus controller (POST /api/token through the proxy).
class SessionsController < ApplicationController
  def new
  end
end
