/// <reference path="./kino.d.ts" />

// Plugin de Kino: Latanime (latanime.org)
// Catálogo de anime con doblaje latino, castellano y subtitulado.
// Solución de imágenes para evitar el bloqueo Hotlink/403 de Cloudflare en Kino TV.
// Exporta Inicio (home), Navegación (browse), Categorías (categories), Buscador (search), Episodios y Reproducción (resolve).

const BASE_URL = "https://latanime.org";
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ──────────────────────────────────────────────────────────────
// HELPERS GENERALES Y PARSING DE IMÁGENES
// ──────────────────────────────────────────────────────────────

function fullUrl(path) {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return BASE_URL + (path.startsWith("/") ? path : "/" + path);
}

function decodeEntities(str) {
  if (!str) return "";
  return String(str)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .trim();
}

function cleanText(html) {
  if (!html) return "";
  return decodeEntities(html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " "));
}

/**
 * Corrige el bloqueo Hotlink (HTTP 403 Forbidden) de Cloudflare en Kino TV.
 * Al pasar la imagen por el CDN proxy de DuckDuckGo, se entrega directamente
 * a la app de Kino (Glide/Android TV) sin bloqueos ni encabezados restringidos.
 */
function safeImageUrl(url) {
  if (!url) return undefined;
  let clean = String(url).trim();
  if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
    if (clean.startsWith("//")) clean = "https:" + clean;
    else if (clean.startsWith("/")) clean = BASE_URL + clean;
    else return undefined;
  }
  if (clean.includes("capblank.png")) return undefined;

  if (clean.includes("latanime.org")) {
    return "https://proxy.duckduckgo.com/iu/?u=" + encodeURIComponent(clean);
  }
  return clean;
}

function base64Decode(b64) {
  if (typeof atob === "function") {
    try { return atob(b64); } catch {}
  }
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let str = String(b64 || "").replace(/[\t\n\f\r ]+/g, "").replace(/=+$/, "");
  let out = "";
  let bits = 0;
  let acc = 0;
  for (let i = 0; i < str.length; i++) {
    const val = chars.indexOf(str.charAt(i));
    if (val < 0) continue;
    acc = (acc << 6) | val;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }
  return out;
}

async function fetchHtml(url) {
  try {
    const res = await kino.fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "es-ES,es;q=0.9",
        "Referer": BASE_URL + "/"
      },
      timeoutMs: 15000
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (err) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// EXTRACCIÓN DE TARJETAS DE ANIME CON PORTADA
// ──────────────────────────────────────────────────────────────

function parseAnimeCards(html) {
  const items = [];
  const seen = new Set();
  
  const regex = /<a[^>]+href=["'](https:\/\/latanime\.org\/anime\/([^"'/]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = regex.exec(html)) !== null) {
    const url = match[1];
    const slug = match[2];
    const inner = match[3];

    if (seen.has(url)) continue;
    seen.add(url);

    // Título
    let title = "";
    const titleMatch = inner.match(/alt=["']([^"']+)["']/i) || 
                       inner.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
                       inner.match(/class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/[a-z0-9]+>/i);
    if (titleMatch) {
      title = cleanText(titleMatch[1]);
    } else {
      title = slug.replace(/-/g, " ");
    }
    title = title.replace(/\s*—\s*Latanime/i, "").replace(/\s*-\s*Latanime/i, "").trim();

    if (!title || title.length < 2) continue;

    // Extracción de imagen de portada (data-src / src)
    let rawPoster = "";
    const dataSrc = inner.match(/data-src=["']([^"']+)["']/i);
    const normalSrc = inner.match(/src=["']([^"']+)["']/i);

    if (dataSrc && !dataSrc[1].includes("capblank.png")) {
      rawPoster = dataSrc[1];
    } else if (normalSrc && !normalSrc[1].includes("capblank.png")) {
      rawPoster = normalSrc[1];
    } else {
      const anyImg = inner.match(/https:\/\/latanime\.org\/(?:thumbs|assets)\/[^"']+\.(?:jpg|png|webp)/i);
      if (anyImg) rawPoster = anyImg[0];
    }

    const poster = safeImageUrl(rawPoster);

    const badges = [];
    if (/latino/i.test(slug) || /latino/i.test(title)) badges.push("Latino");
    if (/castellano/i.test(slug) || /castellano/i.test(title)) badges.push("Castellano");

    items.push({
      id: "anime." + slug,
      ref: url,
      title: title,
      kind: "series",
      poster: poster,
      badges: badges.length > 0 ? badges : undefined
    });
  }

  return items;
}

// ──────────────────────────────────────────────────────────────
// CAPACIDADES: CATEGORÍAS (MOSAICOS DE KINO CON IMAGEN)
// ──────────────────────────────────────────────────────────────

export async function categories() {
  return [
    {
      id: "latino",
      title: "Anime en Audio Latino",
      ref: "cat:latino",
      art: "https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Flatanime.org%2Fthumbs%2Fimagen%2Fone-piece-heroinas-1791913474.webp"
    },
    {
      id: "castellano",
      title: "Anime en Castellano",
      ref: "cat:castellano",
      art: "https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Flatanime.org%2Fassets%2Fimg%2Fserie%2Fportada%2Fbleach-sennen-kessen-hen-s4-latino-1788070469.jpg"
    },
    {
      id: "emision",
      title: "En Emisión Semanal",
      ref: "cat:emision",
      art: "https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Flatanime.org%2Fassets%2Fimg%2Fserie%2Fportada%2Fmushoku-tensei-jobless-reincarnation-temporada-3-backdrop-1785082116.webp"
    },
    {
      id: "accion",
      title: "Acción y Aventura",
      ref: "cat:accion",
      art: "https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Flatanime.org%2Fthumbs%2Fimagen%2Fcyberpunk-edgerunners-s2-castellano-1792522790.jpg"
    },
    {
      id: "isekai",
      title: "Isekai y Fantasía",
      ref: "cat:isekai",
      art: "https://proxy.duckduckgo.com/iu/?u=https%3A%2F%2Flatanime.org%2Fassets%2Fimg%2Fserie%2Fportada%2Fyoujo-senki-temporada-2-backdrop-1785336054.webp"
    }
  ];
}

// ──────────────────────────────────────────────────────────────
// CAPACIDADES: HOME Y BROWSE
// ──────────────────────────────────────────────────────────────

export async function home() {
  const rows = [];

  // 1. Destacados / Recientes de la portada
  const homeHtml = await fetchHtml(BASE_URL + "/");
  if (homeHtml) {
    const homeItems = parseAnimeCards(homeHtml);
    if (homeItems.length > 0) {
      rows.push({
        id: "recientes",
        title: "Novedades y Estrenos",
        ref: "cat:recientes",
        items: homeItems.slice(0, 24)
      });
    }
  }

  // 2. En Emisión
  const emisionHtml = await fetchHtml(BASE_URL + "/emision");
  if (emisionHtml) {
    const emisionItems = parseAnimeCards(emisionHtml);
    if (emisionItems.length > 0) {
      rows.push({
        id: "emision",
        title: "En Emisión Semanal",
        ref: "cat:emision",
        items: emisionItems.slice(0, 24)
      });
    }
  }

  // 3. Audio Latino
  const latinoHtml = await fetchHtml(BASE_URL + "/animes?genero=latino");
  if (latinoHtml) {
    const latinoItems = parseAnimeCards(latinoHtml);
    if (latinoItems.length > 0) {
      rows.push({
        id: "latino",
        title: "Anime en Audio Latino",
        ref: "cat:latino",
        items: latinoItems.slice(0, 24)
      });
    }
  }

  // 4. Audio Castellano
  const castellanoHtml = await fetchHtml(BASE_URL + "/animes?genero=castellano");
  if (castellanoHtml) {
    const casItems = parseAnimeCards(castellanoHtml);
    if (casItems.length > 0) {
      rows.push({
        id: "castellano",
        title: "Anime en Castellano",
        ref: "cat:castellano",
        items: casItems.slice(0, 24)
      });
    }
  }

  // 5. Acción / Populares
  const accionHtml = await fetchHtml(BASE_URL + "/animes?genero=accion");
  if (accionHtml) {
    const accionItems = parseAnimeCards(accionHtml);
    if (accionItems.length > 0) {
      rows.push({
        id: "accion",
        title: "Acción y Aventura",
        ref: "cat:accion",
        items: accionItems.slice(0, 24)
      });
    }
  }

  return rows;
}

export async function browse(ref, cursor) {
  const page = parseInt(cursor || "1", 10);
  let targetUrl = "";

  if (ref === "cat:emision") {
    targetUrl = `${BASE_URL}/emision?page=${page}`;
  } else if (ref === "cat:latino") {
    targetUrl = `${BASE_URL}/animes?genero=latino&page=${page}`;
  } else if (ref === "cat:castellano") {
    targetUrl = `${BASE_URL}/animes?genero=castellano&page=${page}`;
  } else if (ref === "cat:accion") {
    targetUrl = `${BASE_URL}/animes?genero=accion&page=${page}`;
  } else if (ref === "cat:isekai") {
    targetUrl = `${BASE_URL}/animes?genero=isekai&page=${page}`;
  } else if (ref && ref.startsWith("cat:")) {
    const cat = ref.replace("cat:", "");
    targetUrl = `${BASE_URL}/animes?genero=${encodeURIComponent(cat)}&page=${page}`;
  } else {
    targetUrl = `${BASE_URL}/animes?page=${page}`;
  }

  const html = await fetchHtml(targetUrl);
  if (!html) return { items: [] };

  const items = parseAnimeCards(html);
  const hasMore = items.length >= 20;

  return {
    items: items,
    next: hasMore ? String(page + 1) : undefined
  };
}

// ──────────────────────────────────────────────────────────────
// CAPACIDAD: SEARCH
// ──────────────────────────────────────────────────────────────

export async function search(query) {
  const q = (typeof query === "string" ? query : (query && query.q ? query.q : "")).trim();
  if (!q) return [];

  const searchUrl = `${BASE_URL}/animes?buscar=${encodeURIComponent(q)}`;
  const html = await fetchHtml(searchUrl);
  if (!html) return [];

  const items = parseAnimeCards(html);

  const qTokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const matched = items.filter(it => {
    const titleLow = it.title.toLowerCase();
    return qTokens.every(tok => titleLow.includes(tok));
  });

  return (matched.length > 0 ? matched : items).slice(0, 30);
}

// ──────────────────────────────────────────────────────────────
// CAPACIDAD: EPISODES
// ──────────────────────────────────────────────────────────────

export async function episodes(ref) {
  const animeUrl = fullUrl(ref);
  const html = await fetchHtml(animeUrl);
  if (!html) {
    return { episodes: [] };
  }

  // Título
  const titleM = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  let title = titleM ? titleM[1] : "";
  title = title.replace(/\s*—\s*Latanime/i, "").replace(/\s*-\s*Latanime/i, "").trim();

  // Sinopsis
  const descM = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  const overview = descM ? decodeEntities(descM[1]) : "";

  // Poster optimizado
  const imgM = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  const poster = imgM ? safeImageUrl(imgM[1]) : undefined;

  // Extraer enlaces a los capítulos (/ver/...)
  const epRegex = /<a[^>]+href=["'](https:\/\/latanime\.org\/ver\/([^"'/]+))["'][^>]*>([\s\S]*?)<\/a>/gi;
  const epList = [];
  const seenUrls = new Set();
  let m;

  while ((m = epRegex.exec(html)) !== null) {
    const epUrl = m[1];
    const epSlug = m[2];
    if (seenUrls.has(epUrl)) continue;
    seenUrls.add(epUrl);

    const numM = epSlug.match(/episodio-(\d+)/i);
    const num = numM ? parseInt(numM[1], 10) : epList.length + 1;

    epList.push({
      id: epSlug,
      ref: epUrl,
      season: 1,
      number: num,
      title: `Episodio ${num}`,
      overview: ""
    });
  }

  epList.sort((a, b) => a.number - b.number);

  return {
    series: {
      title: title || "Anime",
      overview: overview || undefined,
      poster: poster
    },
    episodes: epList
  };
}

// ──────────────────────────────────────────────────────────────
// CAPACIDAD: RESOLVE (REPRODUCCIÓN)
// ──────────────────────────────────────────────────────────────

export async function resolve(ref) {
  const epUrl = fullUrl(ref);
  const html = await fetchHtml(epUrl);
  if (!html) {
    throw new Error("No se pudo cargar la página del capítulo");
  }

  const regexPlayers = /<a[^>]*class=["'][^"']*play-video[^"']*["'][^>]*data-player=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const servers = [];
  let match;

  while ((match = regexPlayers.exec(html)) !== null) {
    const b64 = match[1];
    const serverName = cleanText(match[2]) || "Servidor";
    const decodedUrl = base64Decode(b64);
    if (decodedUrl && /^https?:\/\//i.test(decodedUrl)) {
      servers.push({
        name: serverName,
        url: decodedUrl
      });
    }
  }

  if (servers.length === 0) {
    throw new Error("No se encontraron servidores de video disponibles para este capítulo");
  }

  for (const srv of servers) {
    const targetUrl = srv.url;

    // 1. VOE directo
    if (/voe\.sx/i.test(targetUrl)) {
      try {
        const voeHtml = await fetchHtml(targetUrl);
        if (voeHtml) {
          const m3u8Match = voeHtml.match(/["'](https:\/\/[^"']+\.m3u8[^"']*)["']/i);
          if (m3u8Match) {
            return {
              url: m3u8Match[1],
              format: "hls",
              headers: { "Referer": targetUrl, "User-Agent": USER_AGENT },
              label: "VOE"
            };
          }
          const mp4Match = voeHtml.match(/["'](https:\/\/[^"']+\.mp4[^"']*)["']/i);
          if (mp4Match) {
            return {
              url: mp4Match[1],
              format: "mp4",
              headers: { "Referer": targetUrl, "User-Agent": USER_AGENT },
              label: "VOE"
            };
          }
        }
      } catch {}
    }

    // 2. Mp4Upload directo
    if (/mp4upload\.com/i.test(targetUrl)) {
      try {
        const mp4Html = await fetchHtml(targetUrl);
        if (mp4Html) {
          const directMp4 = mp4Html.match(/player\.src\(["'](https:\/\/[^"']+\.mp4[^"']*)["']/i) ||
                            mp4Html.match(/src:\s*["'](https:\/\/[^"']+\.mp4[^"']*)["']/i);
          if (directMp4) {
            return {
              url: directMp4[1],
              format: "mp4",
              headers: { "Referer": targetUrl, "User-Agent": USER_AGENT },
              label: "Mp4Upload"
            };
          }
        }
      } catch {}
    }

    // 3. Captura con navegador incrustado de Kino
    if (typeof kino !== "undefined" && kino.browser && typeof kino.browser.capture === "function") {
      try {
        const cap = await kino.browser.capture(targetUrl, {
          timeoutMs: 25000,
          headers: { "Referer": epUrl, "User-Agent": USER_AGENT }
        });
        if (cap && Array.isArray(cap.media) && cap.media.length > 0) {
          const bestMedia = cap.media.find(m => m && m.url && /^https:\/\//i.test(m.url)) || cap.media[0];
          if (bestMedia && bestMedia.url) {
            const isHls = /\.m3u8/i.test(bestMedia.url) || /application\/x-mpegurl|vnd\.apple\.mpegurl/i.test(bestMedia.mime || "");
            return {
              url: bestMedia.url,
              format: isHls ? "hls" : "mp4",
              headers: bestMedia.headers || { "Referer": targetUrl },
              label: srv.name
            };
          }
        }
      } catch {}
    }
  }

  const fallback = servers[0];
  return {
    url: fallback.url,
    label: fallback.name,
    headers: { "Referer": epUrl }
  };
}
