# Plugin de Latanime para Kino TV

Plugin para la aplicación **Kino** (Android TV, Fire Stick y dispositivos móviles) que permite ver anime online desde [latanime.org](https://latanime.org/) con opciones de audio latino, castellano y subtitulado en español.

---

## Características

- **Catálogo Completo:** Acceso a series de anime, OVAs y películas.
- **Secciones en Inicio:**
  - Novedades y Estrenos recientes.
  - Animes en emisión semanal.
  - Anime con doblaje latino.
  - Anime en castellano.
  - Animes de acción y populares.
- **Búsqueda Integrada:** Busca por nombre desde el buscador global de Kino.
- **Episodios y Temporadas:** Lista completa de capítulos organizados y ordenados.
- **Multi-servidor con reproducción nativa:** Compatible con los principales reproductores (VOE, Mp4Upload, Playmogo, Savefiles, Hexload, etc.) utilizando el navegador webview en segundo plano de Kino.

---

## Archivos incluidos

- `kino-plugin.json` — Manifiesto oficial del plugin (id, nombre, versión, capacidades, permisos de red).
- `plugin.js` — Módulo JavaScript con las capacidades `home`, `browse`, `search`, `episodes` y `resolve`.
- `icon.png` — Ícono del plugin en alta resolución.
- `kino.d.ts` — Declaraciones de TypeScript para autocompletado de la API `kino`.
- `contract.json` — Especificación oficial del contrato de Kino.
- `sdk/` — Herramientas del SDK oficial para validar y probar el plugin localmente.

---

## Cómo publicar tu plugin en GitHub (Paso a Paso)

Para que Kino pueda instalar tu plugin o mostrarlo a la comunidad:

1. **Crea una cuenta o inicia sesión en GitHub** ([github.com](https://github.com)).
2. **Crea un nuevo repositorio:**
   - Nombre sugerido: `kino-plugin-latanime` (o el nombre que prefieras).
   - Tipo: **Público** (Public).
   - No inicialices con README (deja el repositorio vacío).
3. **Sube los archivos del plugin:**
   Puedes subir los archivos directamente desde el navegador (botón *Upload files*) o con Git:
   ```bash
   git init
   git add .
   git commit -m "Versión inicial del plugin Latanime"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/kino-plugin-latanime.git
   git push -u origin main
   ```
4. **Agrega la etiqueta obligatoria:**
   - En la página principal de tu repositorio en GitHub, a la derecha en la sección **About**, haz clic en el engranaje ⚙️.
   - En el campo **Topics**, añade la etiqueta: `kino-plugin`
   - Guarda los cambios. (Esto permite que Kino reconozca tu repositorio y pueda mostrarlo en la pestaña de la comunidad).

---

## Cómo instalar el plugin en Kino

1. Abre **Kino** en tu dispositivo (Android TV, Fire Stick o Celular).
2. Ve a **Ajustes** (ícono de engranaje) > **Plugins**.
3. Selecciona **Añadir plugin**.
4. Escribe tu usuario y repositorio de GitHub:
   ```text
   TU_USUARIO/kino-plugin-latanime
   ```
   *(O pega el enlace directo a tu archivo `kino-plugin.json` en raw.githubusercontent.com)*.
5. Revisa los permisos y presiona **Instalar**.

---

## Prueba local con el SDK

Si quieres hacer cambios o probar el plugin en tu computadora antes de subirlo:

```bash
# Validar el plugin
node sdk/validate.mjs .

# Probar la portada (home)
node sdk/validate.mjs . --run home

# Probar episodios de un anime
node sdk/validate.mjs . --run episodes "https://latanime.org/anime/bleach-sennen-kessen-hen-s4-latino"
```
