# MUNDO SIMZ — Tienda Jamstack autoadministrable

Arquitectura: **sitio estático + CMS basado en Git + función serverless en el edge**.
Sin base de datos, sin servidor que mantener, sin mensualidades.

```
Cliente (navegador)
      │  contraseña
      ▼
Cloudflare Pages Function  ──►  GitHub API  ──►  commit en el repo
   (edge, gratis)               (token en                │
   valida la contraseña          variable de             │ webhook
   el token NUNCA sale           entorno)                ▼
   del servidor                                  Cloudflare rebuild
                                                         │
                                                         ▼
                                              Sitio publicado (CDN)
```

**Todo queda versionado en Git:** cada página que sube el cliente es un commit. Puedes ver el historial, comparar y revertir cualquier cambio desde GitHub.

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

## 4. Variables de entorno (aquí está la clave del asunto)

En el proyecto de Pages → **Settings → Environment variables → Production**:

| Variable | Valor | Tipo |
|---|---|---|
| `ADMIN_PASSWORD` | la contraseña del cliente | **Secret** (encrypt) |
| `GITHUB_TOKEN` | el token del paso 2 | **Secret** (encrypt) |
| `GITHUB_REPO` | `usuario/repositorio` | Texto |
| `GITHUB_BRANCH` | `main` | Texto |

Vuelve a desplegar (**Deployments → Retry deployment**) para que las variables se apliquen.

## 5. Listo

* Web: `https://tu-proyecto.pages.dev`
* Panel del cliente: `https://tu-proyecto.pages.dev/admin.html`

El cliente entra con su contraseña y puede:

* **Subir páginas de cómic** a cualquiera de los 20 niveles (se renombran solas: `t3-01.jpg`, `t3-02.jpg`…).
* **Borrar páginas.**
* **Bloquear / desbloquear niveles**, renombrarlos o marcarlos como *libres* (jugables sin terminar el anterior).
* **Editar los 10 productos** de la tienda: foto, nombre, precio, etiqueta y estado *Próximamente*.

Cada acción genera un commit; Cloudflare reconstruye el sitio en **30-60 segundos** y todos los usuarios ven el contenido nuevo al recargar.

---

## Seguridad

* El **token de GitHub nunca llega al navegador**. Vive cifrado en Cloudflare y solo lo usa la función del edge.
* La contraseña se valida **en el servidor**, con comparación en tiempo constante.
* La función solo acepta rutas concretas: imágenes (`t{n}-{nn}`, `producto-{n}`) y los dos JSON. No puede tocar el resto del repositorio ni el propio código.
* Si el cliente rota la contraseña o el token, basta con cambiar la variable en Cloudflare — sin tocar código.

## Costos

| Concepto | Costo |
|---|---|
| Hosting y CDN (Cloudflare Pages) | 0 € — ancho de banda ilimitado |
| Funciones edge | 0 € — 100.000 peticiones al día |
| Repositorio y versionado (GitHub) | 0 € |
| Base de datos | no hay |
| **Total mensual** | **0 €** |

## Modo vista previa

Si abres `admin.html` con doble clic (sin servidor) o desde un hosting sin funciones, el panel arranca en **modo vista previa**: se puede probar todo, pero no publica nada. Es útil para enseñárselo al cliente antes de darle acceso real.
