# Landing Healthy — imagen estática para Railway
# Sirve index4.html tal cual (HTML + Tailwind CDN + JS inline, sin build de Vite)
FROM nginx:1.27-alpine

# La imagen oficial de nginx procesa /etc/nginx/templates/*.template con envsubst
# al arrancar, así que ${PORT} (inyectado por Railway) se resuelve en runtime
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

COPY index4.html /usr/share/nginx/html/
# images/, videos/ y frames/ se sirven desde la raíz (/images, /videos, /frames)
COPY public/ /usr/share/nginx/html/

ENV PORT=8080
EXPOSE 8080
