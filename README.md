# DentAll — Visor de Catálogos PDF

Visor estático de catálogos PDF para DentAll. Funciona 100% del lado del cliente sin backend.

## Uso

Abre en el navegador vía un servidor HTTP:

```
http://localhost:8000/index.html?pdf=ortodoncia.pdf&page=1
```

### Parámetros URL

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `pdf` | String | Sí | Nombre del archivo PDF en `./assets/` |
| `page` | Integer | No | Página inicial (default: `1`) |

Si se accede sin parámetros, redirige automáticamente a `?pdf=ortodoncia.pdf&page=1`.

## Estructura

```
├── index.html              ← Cabecera, visor, pie de página
├── css/styles.css          ← Estilos, layout flex, responsive
├── js/app.js               ← Lógica PDF.js, colas, zoom, descarga
├── assets/
│   ├── logo-blanco.webp    ← Logo DentAll
│   ├── ortodoncia.pdf      ← Catálogo de ejemplo
│   └── favicon.ico         ← Favicon
└── SDD.md                  ← Documento de diseño
```

## Tecnologías

- **PDF.js 3.11.174** — Renderizado de PDF en canvas
- **Bootstrap 5.3.3** — Layout responsive y utilidades
- **Bootstrap Icons 1.11.3** — Iconografía

Todo se carga vía CDN. No hay npm, bundler ni build steps.

## Desarrollo

Requisito: servidor HTTP local (no funciona con `file://` por CORS).

```bash
# Opción 1: PHP built-in server
php -S localhost:8000

# Opción 2: Python
python -m http.server 8000

# Opción 3: Node.js (si está instalado)
npx serve .
```

## Tracking

El visor registra cada carga de página en la API de tracking:

```
POST http://localhost/dentall-catalog-api/api/v1/tracking/scan
Authorization: Basic <base64(user:pass)>
Content-Type: application/json

{ "page_number": 1 }
```

- La petición es **fire-and-forget**: no bloquea la carga del visor.
- Si el API no responde, el visor funciona normalmente.
- Se registra una sola vez por carga de página (lectura inicial del catálogo).

## Funcionalidades

- Navegación por páginas (prev / next)
- Zoom in / out
- Descarga directa del PDF
- Sistema de colas para clicks rápidos
- Diseño mobile-first con botones táctiles (≥44px)
- Footer con información de contacto por país (Guatemala, El Salvador, Honduras)
- Redirección automática al catálogo por defecto
- Tracking de escaneos vía API (fire-and-forget)

## Paleta de colores

| Color | Hex | Uso |
|-------|-----|-----|
| Azul oscuro | `#004e64` | Header, footer inferior |
| Turquesa | `#00a7b5` | Acentos, iconos |
| Cyan claro | `#EBF8F9` | Sección de contacto del footer |
