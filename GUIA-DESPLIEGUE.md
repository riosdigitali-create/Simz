# MUNDO SIMZ — Tienda Jamstack autoadministrable

Arquitectura: **sitio estático + CMS basado en Git + R2 para las imágenes + una función serverless en el edge**.
Sin base de datos, sin servidor que mantener, sin mensualidades.

```
Cliente (navegador)
      │  comprime a WebP y sube de 6 en 6
      │  contraseña
      ▼
Cloudflare Pages Function ──┬──► R2  ──────────► páginas del cómic
   (edge, gratis)           │    (online al instante, sin rebuild)
   valida la contraseña     │
   el token NUNCA sale      └──► GitHub API ───► commit (JSON de estado)
   del servidor                                       │ webhook
                                                      ▼
                                             Cloudflare rebuild
                                                      │
                                                      ▼
                                           Sitio publicado (CDN)
```

## Los dos almacenes — y por qué

| Qué | Dónde | Por qué |
|---|---|---|
| Páginas del cómic (`t3-0001.webp`) | **R2** | Sin límite de objetos, borrar libera espacio de verdad, y subir **no dispara rebuild**: están online al instante. |
| Páginas antiguas (`t1-07.jpg`) | Repo | Las que ya estaban. **No se migran ni se tocan.** |
| `temporadas.json`, `productos.json`, fotos de producto | Repo | Pequeños y cambian poco: ahí el historial y el rollback de Git salen gratis. |

El front decide de dónde sirve cada página **por el nombre**, sin consultar nada:

```
t1-07.jpg     →  2-3 dígitos  →  el propio sitio   (las de siempre)
t1-0007.webp  →  4 dígitos    →  R2
```

Por eso las fotos que el cliente ya subió siguen funcionando igual, y las nuevas conviven con ellas en el mismo nivel y en orden. **Migración: ninguna.**

> **Por qué las imágenes salieron de Git.** Git guarda todas las versiones para siempre: borrar una foto no libera nada y el repo solo crece. Además Cloudflare Pages admite **20.000 archivos por despliegue** en el plan gratuito, y cada subida era un commit + un rebuild de 30-60 s. Con mil páginas por nivel eso no se sostiene.

---

## 1. Sube el proyecto a GitHub

Sube todos los archivos de esta carpeta a un repositorio (puede ser privado).

```
index.html          el mapa y el lector de cómics
tienda.html         la tienda (10 productos)
admin.html          el panel del cliente
functions/api/[[route]].js   la función serverless (edge)
t1-01.jpg …         las páginas del cómic
musica.mp3          la banda sonora
productos.json      lo genera el panel (tienda)
temporadas.json     lo genera el panel (niveles)
```

## 2. Crea el token de GitHub

GitHub → **Settings → Developer settings → Fine-grained tokens → Generate new token**

* **Repository access:** Only select repositories → tu repositorio.
* **Permissions → Repository permissions → Contents:** `Read and write`.
* Copia el token (empieza por `github_pat_`). **No lo pegues en ningún archivo del proyecto.**

## 3. Conecta Cloudflare Pages

[dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages → Create → Pages → Connect to Git**

* Elige el repositorio.
* **Framework preset:** None.
* **Build command:** *(vacío)*
* **Build output directory:** `/`
* Deploy.

## 4. Crea el bucket R2 (aquí es donde viven las páginas)

Cloudflare → **R2 → Create bucket** → nombre: `mundo-simz-paginas` (ubicación: automática).

### 4.1 Dale un dominio público

R2 → tu bucket → **Settings → Public access → Custom domain → Connect domain**
→ por ejemplo `img.tu-dominio.com`.

> **Usa un dominio propio, no la URL `r2.dev`.** La `r2.dev` está limitada a propósito y no es para producción. Con dominio propio pasa por el CDN de Cloudflare: rápido y con ancho de banda gratis.

Anota la URL: es tu `R2_PUBLIC_URL`.

### 4.2 Conecta el bucket a la función

Pages → tu proyecto → **Settings → Functions → R2 bucket bindings → Add binding**

| Campo | Valor |
|---|---|
| Variable name | `IMAGES` |
| R2 bucket | `mundo-simz-paginas` |

El nombre `IMAGES` tiene que ser exacto: es el que lee la función.

## 5. Variables de entorno (aquí está la clave del asunto)

En el proyecto de Pages → **Settings → Environment variables → Production**:

| Variable | Valor | Tipo |
|---|---|---|
| `ADMIN_PASSWORD` | la contraseña del cliente | **Secret** (encrypt) |
| `GITHUB_TOKEN` | el token del paso 2 | **Secret** (encrypt) |
| `GITHUB_REPO` | `usuario/repositorio` | Texto |
| `GITHUB_BRANCH` | `main` | Texto |
| `R2_PUBLIC_URL` | `https://img.tu-dominio.com` | Texto |

Vuelve a desplegar (**Deployments → Retry deployment**) para que todo se aplique.

> **No hay que copiar la URL de R2 a ningún archivo.** El panel la lee de `R2_PUBLIC_URL` y la publica dentro de `temporadas.json`; la web la aprende de ahí. Se configura en un solo sitio a propósito: teniendo la URL en dos lugares, tarde o temprano uno se queda desactualizado y la web sirve 404 mientras el panel se ve perfecto.

## 6. Comprueba que R2 está activo

Entra en el panel. Arriba debe aparecer:

* 🟢 **PUBLICANDO · R2 ACTIVO** → todo correcto.
* 🟠 **PUBLICANDO EN … (sin R2: lento)** → falta el binding `IMAGES` o la variable `R2_PUBLIC_URL`. **Subir páginas dará error hasta que lo arregles** (a propósito: una página guardada en el sitio equivocado quedaría invisible e imposible de borrar). El resto del panel funciona.

## 7. Listo

* Web: `https://tu-proyecto.pages.dev`
* Panel del cliente: `https://tu-proyecto.pages.dev/admin.html`

El cliente entra con su contraseña y puede:

* **Subir páginas de cómic** a cualquiera de los 20 niveles (se renombran solas: `t3-0001.webp`, `t3-0002.webp`…). Pueden ser **cientos o miles de golpe**: se comprimen en su propio navegador y se suben de 6 en 6.
* **Borrar páginas.**
* **Bloquear / desbloquear niveles**, renombrarlos o marcarlos como *libres* (jugables sin terminar el anterior).
* **Editar los 10 productos** de la tienda: foto, nombre, precio, etiqueta y estado *Próximamente*.

Las páginas nuevas están **online al instante** (van a R2, no esperan rebuild). Los cambios de niveles y tienda sí generan un commit y tardan **30-60 segundos**.

---

## Medición de audiencia

Cloudflare → **Analytics & Logs → Web Analytics → Add a site** → copia el token y pégalo en `index.html`:

```js
const CF_ANALYTICS_TOKEN = '';   // ← pegar aquí el token
```

Te da visitas, visitantes únicos, país, dispositivo y **referrer** — cuando pegues el link en otra web, ahí ves cuánta gente llegó desde ella.

Es gratis, ilimitado y **sin cookies**, lo que importa por dos motivos prácticos: no necesitas banner de consentimiento (RGPD), y los bloqueadores de anuncios no lo tumban — con Google Analytics se pierde en torno a un 30-40% del tráfico real.

Mientras el token esté vacío no se carga ningún script.

---

## Seguridad

* El **token de GitHub nunca llega al navegador**. Vive cifrado en Cloudflare y solo lo usa la función del edge.
* La contraseña se valida **en el servidor**, con comparación en tiempo constante.
* La función solo acepta rutas concretas: páginas (`t{n}-{nn}`, `t{n}-{nnnn}`), fotos de producto (`producto-{n}`) y los dos JSON. No puede tocar el resto del repositorio ni el propio código.
* El bucket R2 es **público solo en lectura**. Escribir en él exige pasar por la función, que valida la contraseña.
* Si el cliente rota la contraseña o el token, basta con cambiar la variable en Cloudflare — sin tocar código.

## Costos

| Concepto | Costo |
|---|---|
| Hosting y CDN (Cloudflare Pages) | 0 € — ancho de banda ilimitado |
| Funciones edge | 0 € — 100.000 peticiones al día |
| **Almacenamiento R2** | **0 € hasta 10 GB · salida de datos siempre gratis** |
| Analítica (Cloudflare Web Analytics) | 0 € — ilimitada |
| Repositorio y versionado (GitHub) | 0 € |
| Base de datos | no hay |
| **Total mensual** | **0 €** |

Con WebP a 1600px una página pesa ~250 KB: **10 GB ≈ 40.000 páginas**. A mil páginas por nivel son unos 40 niveles antes de rozar el límite gratuito (y a partir de ahí son ~0,015 $/GB al mes).

## Rendimiento — qué se arregló y por qué

| Problema | Antes | Ahora |
|---|---|---|
| Subir 1000 fotos | 1000 commits en fila, 20-40 min | Comprimidas en el navegador, 6 en paralelo a R2 |
| Peso por página | 3-6 MB (JPG de cámara) | ~250 KB (WebP 1600px) |
| Abrir la web | Sondeaba a ciegas hasta la pág. 300 × 20 niveles = miles de 404 | Lee `temporadas.json` y ya: 1 petición |
| Abrir un nivel | Montaba las 1000 imágenes de golpe → el navegador se quedaba sin memoria | Solo las cercanas a la pantalla; al alejarse se liberan |
| Abrir el panel | Listaba el repo entero | Lista solo el nivel que estás viendo, paginado |
| Techo real | 20.000 archivos por despliegue | Sin límite práctico de objetos |

> **El detalle que no se ve pero es el importante:** el panel ya no carga todos los niveles a la vez, así que al publicar `temporadas.json` conserva intacta la lista de los niveles que no has abierto. Sin esa salvaguarda, abrir el panel y pulsar *publicar niveles* habría borrado las páginas de los 19 niveles que no estabas mirando.

## Modo vista previa

Si abres `admin.html` con doble clic (sin servidor) o desde un hosting sin funciones, el panel arranca en **modo vista previa**: se puede probar todo, pero no publica nada. Es útil para enseñárselo al cliente antes de darle acceso real.

## Límites honestos (dilos antes de venderlo)

* Los cambios de **niveles y tienda** tardan 30-60 s en verse (rebuild). Las **páginas** ya no: son instantáneas.
* Un solo usuario admin, una sola contraseña. Sin roles ni auditoría por persona.
* Sin checkout ni pagos: la tienda es un catálogo. Cobrar requiere Stripe o similar aparte.
* Escala sin límite en lectura (CDN); en escritura es un panel para una persona.
* La compresión ocurre en el navegador del cliente: subir 1000 fotos le calentará el portátil un rato. Es el precio de no pagar un servidor de procesado.
* Las páginas antiguas del repo siguen contando para el límite de 20.000 archivos de Pages. Son pocas y no crecen, pero ahí están.
