FROM nginx:alpine

# Install gettext for envsubst
RUN apk add --no-cache gettext

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy config template (DOMAIN will be substituted at startup)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Create directory for Let's Encrypt ACME challenge
RUN mkdir -p /var/www/certbot

# Create directory for SSL certificates
RUN mkdir -p /etc/letsencrypt

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

EXPOSE 80 443

# Substitute $DOMAIN at runtime, then start nginx
CMD ["/bin/sh", "-c", "envsubst '$DOMAIN' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && nginx -g 'daemon off;'"]
