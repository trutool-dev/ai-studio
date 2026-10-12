# Etapa 1 — build (solo necesaria si la landing usa un paso de compilación)
# Si landing/index.html es un fichero estático sin build step, esta etapa se omite
# y nginx sirve directamente los archivos copiados desde el contexto de build.

FROM nginx:alpine AS runner

# Eliminar la configuración por defecto de nginx
RUN rm /etc/nginx/conf.d/default.conf

# Copiar configuración personalizada de nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar los archivos estáticos de la landing al directorio raíz de nginx
# El contexto de build debe ser projects/healthy/landing/ (ver deploy.sh)
COPY . /usr/share/nginx/html/

# Cloud Run inyecta la variable PORT — nginx escucha en ese puerto
# Por defecto 8080 (el estándar de Cloud Run)
EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
