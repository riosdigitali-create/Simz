/**
 * MUNDO SIMZ — API serverless (Cloudflare Pages Functions, edge)
 * ---------------------------------------------------------------
 * El token de GitHub NUNCA sale del servidor: vive como variable de
 * entorno cifrada en Cloudflare. El navegador solo envía la contraseña
 * del panel; esta función valida y hace el commit en el repositorio.
 *
 * Variables de entorno (Cloudflare → Settings → Environment variables):
 *   ADMIN_PASSWORD   contraseña del panel            (secreta)
 *   GITHUB_TOKEN     token fine-grained, Contents:RW (secreta)
 *   GITHUB_REPO      usuario/repositorio
 *   GITHUB_BRANCH    main            (opcional)
 *
 * Rutas:  POST /api/login · /api/list · /api/upload · /api/delete · /api/save
 */

const GH = 'https://api.github.com';

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });

/** comparación en tiempo constante (evita filtrar la clave por tiempos de respuesta) */
function safeEqual(a = '', b = '') {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function ghHeaders(env) {
  return {
    Authorization: 'Bearer ' + env.GITHUB_TOKEN,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mundo-simz-cms',
    'content-type': 'application/json'
  };
}

async function gh(env, path, init = {}) {
  const r = await fetch(GH + path, { ...init, headers: ghHeaders(env) });
  const txt = await r.text();
  let body = {};
  try { body = txt ? JSON.parse(txt) : {}; } catch (e) { body = { message: txt }; }
  if (!r.ok) throw new Error(body.message || 'GitHub HTTP ' + r.status);
  return body;
}

const repo = env => env.GITHUB_REPO;
const branch = env => env.GITHUB_BRANCH || 'main';

/** sha actual de un archivo (null si no existe) */
async function shaOf(env, path) {
  try {
    const r = await gh(env, `/repos/${repo(env)}/contents/${encodeURIComponent(path)}?ref=${branch(env)}`);
    return r.sha || null;
  } catch (e) { return null; }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  const route = (Array.isArray(params.route) ? params.route.join('/') : params.route || '').toLowerCase();

  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (request.method !== 'POST') return json({ ok: false, error: 'Método no permitido' }, 405);

  if (!env.ADMIN_PASSWORD || !env.GITHUB_TOKEN || !env.GITHUB_REPO) {
    return json({ ok: false, error: 'Faltan variables de entorno en Cloudflare (ADMIN_PASSWORD, GITHUB_TOKEN, GITHUB_REPO)' }, 500);
  }

  let body;
  try { body = await request.json(); } catch (e) { return json({ ok: false, error: 'JSON inválido' }, 400); }

  // ---- autenticación: la contraseña se valida SIEMPRE en el servidor ----
  if (!safeEqual(body.password || '', env.ADMIN_PASSWORD)) {
    return json({ ok: false, error: 'Contraseña incorrecta' }, 401);
  }

  try {
    switch (route) {

      /* --- comprobar acceso --- */
      case 'login':
        return json({ ok: true, repo: repo(env), branch: branch(env) });

      /* --- listar archivos publicados --- */
      case 'list': {
        const files = await gh(env, `/repos/${repo(env)}/contents?ref=${branch(env)}`);
        return json({
          ok: true,
          files: (Array.isArray(files) ? files : [])
            .filter(f => f.type === 'file')
            .map(f => ({ name: f.name, path: f.path, sha: f.sha, url: f.download_url }))
        });
      }

      /* --- subir imagen (base64) --- */
      case 'upload': {
        const path = String(body.path || '').replace(/[^\w.\-\/]/g, '_');
        if (!path || !body.content) return json({ ok: false, error: 'Faltan datos' }, 400);
        if (!/\.(jpe?g|png|webp|gif|mp3|ogg)$/i.test(path)) return json({ ok: false, error: 'Formato no permitido' }, 400);
        const sha = await shaOf(env, path);
        const r = await gh(env, `/repos/${repo(env)}/contents/${encodeURIComponent(path)}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: body.message || 'Subir ' + path,
            content: body.content,
            branch: branch(env),
            ...(sha ? { sha } : {})
          })
        });
        return json({ ok: true, path, commit: r.commit && r.commit.sha });
      }

      /* --- guardar JSON (tienda / niveles) --- */
      case 'save': {
        const path = String(body.path || '');
        if (!/^(productos|temporadas)\.json$/.test(path)) return json({ ok: false, error: 'Archivo no permitido' }, 400);
        const text = JSON.stringify(body.data, null, 2);
        const content = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
        const sha = await shaOf(env, path);
        await gh(env, `/repos/${repo(env)}/contents/${encodeURIComponent(path)}`, {
          method: 'PUT',
          body: JSON.stringify({
            message: 'Actualizar ' + path,
            content, branch: branch(env), ...(sha ? { sha } : {})
          })
        });
        return json({ ok: true, path });
      }

      /* --- borrar archivo --- */
      case 'delete': {
        const path = String(body.path || '');
        if (!/^(t\d{1,2}-\d{2}\.(jpe?g|png|webp|gif)|producto-\d+\.(jpe?g|png|webp|gif))$/i.test(path)) {
          return json({ ok: false, error: 'Solo se pueden borrar páginas o fotos de producto' }, 400);
        }
        const sha = body.sha || await shaOf(env, path);
        if (!sha) return json({ ok: false, error: 'El archivo no existe' }, 404);
        await gh(env, `/repos/${repo(env)}/contents/${encodeURIComponent(path)}`, {
          method: 'DELETE',
          body: JSON.stringify({ message: 'Borrar ' + path, sha, branch: branch(env) })
        });
        return json({ ok: true, path });
      }

      default:
        return json({ ok: false, error: 'Ruta desconocida' }, 404);
    }
  } catch (e) {
    return json({ ok: false, error: e.message }, 500);
  }
}
