# frozen_string_literal: true

require "net/http"

module Api
  # Proxies all API requests to the legacy .NET backend (PMS API)
  # This allows the new UI to work with the existing API during migration
  #
  # IMPORTANT: This proxy is 100% TRANSPARENT.
  # - It ONLY changes the base URL (localhost → clpmsapi.clavisco.com)
  # - It forwards ALL headers from the UI as-is
  # - The UI must handle authentication (Bearer token)
  # - The UI must include cl-company-id header (PMS: only after company selection)
  # - This ensures the migrated UI will work when we remove the proxy later
  #
  # NOTE (PMS vs EMA): the PMS .NET CORE API serves the token endpoint at
  # /api/token (the Angular login uses ApiUrl + 'api/' + 'token'), so unlike
  # EMA there is NO special-case path rewrite for /api/token here.
  class ProxyController < ApplicationController
    skip_before_action :verify_authenticity_token
    skip_before_action :allow_browser, raise: false

    # Forward any HTTP method to the .NET API
    def forward
      path = request.fullpath
      target_url = "#{legacy_api_base_url}#{path}"

      Rails.logger.info "[Proxy] #{request.method} #{target_url}"

      uri = URI.parse(target_url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl = (uri.scheme == "https")
      http.read_timeout = 30
      http.open_timeout = 10

      # SSL verification settings
      # In development, we may need to skip verification due to CRL issues
      if Rails.env.development? || ENV["SKIP_SSL_VERIFICATION"] == "true"
        http.verify_mode = OpenSSL::SSL::VERIFY_NONE
      else
        http.verify_mode = OpenSSL::SSL::VERIFY_PEER
      end

      http_request = build_http_request(request.method, uri, forwarded_headers)

      # Handle request body
      # For multipart/form-data (FormData), reconstruct it from parsed params
      # because rack.input is consumed by Rails during parameter parsing
      if request.content_type&.start_with?("multipart/form-data")
        boundary = "----RubyFormBoundary#{SecureRandom.hex(16)}"
        multipart_body = build_multipart_body(boundary)
        http_request.body = multipart_body
        http_request["Content-Type"] = "multipart/form-data; boundary=#{boundary}"
        http_request["Content-Length"] = multipart_body.bytesize.to_s
      else
        # For JSON and other content types, raw_post works fine
        http_request.body = request.raw_post.presence
      end

      response = http.request(http_request)

      Rails.logger.info "[Proxy] Response: #{response.code}"
      if response.code.to_i >= 400
        Rails.logger.error "[Proxy] Error response body: #{response.body.to_s[0..500]}"
      end

      # Forward pagination/message headers from backend response to Rails response
      response.each_header do |key, value|
        if key.downcase.start_with?("cl-sl-pagination") || key.downcase == "cl-message"
          self.response.headers[key] = value
        end
      end

      # Return the response as-is (including error responses and headers)
      render body: response.body, status: response.code.to_i, content_type: response["Content-Type"] || "application/json"

    rescue Net::ReadTimeout, Net::OpenTimeout => e
      Rails.logger.error "[Proxy] Timeout: #{e.message}"
      render json: { error: "API request timed out" }, status: :gateway_timeout
    rescue StandardError => e
      Rails.logger.error "[Proxy] Error: #{e.class} - #{e.message}"
      render json: { error: "API request failed: #{e.message}" }, status: :bad_gateway
    end

    private

    def legacy_api_base_url
      ENV.fetch("LEGACY_API_URL", "https://clpmsapi.clavisco.com")
    end

    # Rebuild a generic multipart body from the parsed form params
    # (file uploads are re-encoded with their original filename/content type)
    def build_multipart_body(boundary)
      body = String.new

      request.request_parameters.each do |name, value|
        next if %w[controller action path format].include?(name)

        if value.respond_to?(:read) # uploaded file
          body << "--#{boundary}\r\n"
          body << "Content-Disposition: form-data; name=\"#{name}\"; filename=\"#{value.original_filename}\"\r\n"
          body << "Content-Type: #{value.content_type}\r\n\r\n"
          body << value.read
          body << "\r\n"
        else
          body << "--#{boundary}\r\n"
          body << "Content-Disposition: form-data; name=\"#{name}\"\r\n\r\n"
          body << value.to_s
          body << "\r\n"
        end
      end

      body << "--#{boundary}--\r\n"
      body
    end

    def build_http_request(method, uri, headers)
      request_class = case method.upcase
                      when "GET" then Net::HTTP::Get
                      when "POST" then Net::HTTP::Post
                      when "PUT" then Net::HTTP::Put
                      when "PATCH" then Net::HTTP::Patch
                      when "DELETE" then Net::HTTP::Delete
                      when "OPTIONS" then Net::HTTP::Options
                      when "HEAD" then Net::HTTP::Head
                      else Net::HTTP::Get
                      end

      req = request_class.new(uri.request_uri)
      headers.each { |key, value| req[key] = value }
      # Set the correct Host header for the target API
      req["Host"] = uri.host
      req
    end

    def forwarded_headers
      # Forward ALL headers from the original request:
      #   - Authorization: Bearer {token} (from UI)
      #   - cl-company-id: {id} (from UI, after company selection)
      #   - Cl-Recaptcha-Token (login)
      #   - Content-Type and any other custom headers
      headers = {}

      request.headers.each do |key, value|
        if key.start_with?("HTTP_")
          header_name = key.sub(/^HTTP_/, "").split("_").map(&:capitalize).join("-")

          # IMPORTANT: Keep cl-* headers in lowercase to match Angular Legacy exactly
          # The backend may be case-sensitive for custom headers
          if header_name.start_with?("Cl-") && header_name != "Cl-Recaptcha-Token"
            header_name = header_name.downcase
          end

          headers[header_name] = value
        elsif %w[CONTENT_TYPE CONTENT_LENGTH].include?(key)
          header_name = key.split("_").map(&:capitalize).join("-")
          headers[header_name] = value
        end
      end

      # Remove Accept-Encoding to get uncompressed responses from the API
      headers.delete("Accept-Encoding")

      # Strip browser-only / hop-by-hop headers that the .NET backend doesn't
      # expect. Legacy Angular sends requests WITHOUT cookies and WITHOUT
      # browser navigation headers — we replicate that behaviour here.
      %w[
        Cookie Referer
        Sec-Fetch-Site Sec-Fetch-Mode Sec-Fetch-Dest
        Sec-Ch-Ua Sec-Ch-Ua-Mobile Sec-Ch-Ua-Platform
        Connection Pragma Cache-Control
        Host
      ].each { |h| headers.delete(h) }

      headers
    end
  end
end
