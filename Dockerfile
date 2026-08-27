# The app is built on the developer machine (npm run build:deploy, which needs
# the icon-pack assets) and shipped as dist/ — the VM has 1 GB of RAM, too
# little for a comfortable Vite build.
FROM nginx:1.29-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist /usr/share/nginx/html

# Pre-compress the large text assets so nginx can serve them via gzip_static
# without burning the single CPU on every request.
RUN find /usr/share/nginx/html -type f \
      \( -name '*.json' -o -name '*.js' -o -name '*.css' -o -name '*.html' \
         -o -name '*.svg' -o -name '*.webmanifest' \) \
      -size +1k -exec gzip -9 -k {} \; \
 && rm -f /usr/share/nginx/html/assets/*.map

EXPOSE 80
