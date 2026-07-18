# MUNDO SIMZ

Experiencia web retro: ciudad pixel art interactiva, lector de cómics y Tienda Simz.

**Para publicar el sitio, lee `GUIA-DESPLIEGUE.md`.** Este archivo solo describe qué es cada cosa.

## Los tres sitios

| Archivo | Qué es |
|---|---|
| `index.html` | El mapa, el lector de cómics y el selector de personaje. |
| `tienda.html` | La Tienda Simz. Se llega desde el edificio del mapa o el botón 🛒. |
| `admin.html` | Panel privado: el cliente entra con **una contraseña** y publica sin tocar código. |

## Dónde viven las páginas

Dos almacenes, y el **nombre del archivo** decide cuál:

| Nombre | Vive en | Cuándo |
|---|---|---|
| `t1-0007.webp` (4 dígitos) | **R2** | Todo lo que sube el panel hoy. Online al instante, sin rebuild. |
| `t1-07.jpg` (2-3 dígitos) | **el repo** | Las páginas antiguas. No se migran ni se tocan. |

Ambas conviven: el front resuelve la URL según el nombre. El detalle completo está en la cabecera de `functions/api/[[route]].js` y en `GUIA-DESPLIEGUE.md`.

Formatos válidos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.

## Panel de administración (`/admin.html`)

El cliente entra con **una contraseña**, nada más. Desde ahí puede:

* **Subir páginas**: elige el nivel, arrastra las imágenes y se renombran y publican solas. La temporada aparece en el mapa automáticamente.
* **Borrar páginas** (una o en lote).
* **Bloquear / desbloquear niveles**, renombrarlos o marcarlos como *libres*.
* **Editar los 10 productos** de la tienda (nombre, precio, etiqueta, imagen y si sale como *Próximamente*). Se guardan en `productos.json`.

Arriba del panel hay un indicador de estado:

* 🟢 **PUBLICANDO · R2 ACTIVO** → todo correcto.
* 🟠 **PUBLICANDO EN … (sin R2: lento)** → falta configurar el bucket. Subir páginas dará error hasta arreglarlo. Ver `GUIA-DESPLIEGUE.md`, pasos 4 y 5.
* **MODO VISTA PREVIA** → el panel se abrió sin servidor. Se puede probar todo; no publica nada.

## Seguridad

El **token de GitHub nunca llega al navegador**: vive cifrado en Cloudflare y solo lo usa la función del edge. El cliente solo conoce su contraseña, que se valida en el servidor.

> ⚠️ Nunca pegues el token ni la contraseña en ningún archivo del proyecto. Van en las variables de entorno de Cloudflare. Ver `GUIA-DESPLIEGUE.md`, paso 5.

## Controles

* **PC:** ← → mover · Enter/Espacio entrar · clic en un nivel · Esc salir del lector.
* **Móvil:** botones ◀ A ▶ o toca directamente el nivel.
* **Panel oculto del sitio:** `Ctrl + Shift + A` (títulos de temporadas, bloquear/desbloquear, texto de la tienda, reiniciar progreso).

## Qué incluye

Mapa de 20 niveles con ciclo día/noche, coches, nubes y pájaros · personaje animado · cinemáticas · lector con zoom, pantalla completa y barra de progreso · Tienda Simz con tarjetas *Próximamente* · progreso guardado en el navegador · banda sonora chiptune generada en tiempo real.
