# Unmask V1

Versión jugable con salas multijugador, números aleatorios, chat anónimo, rondas, respuestas, investigación, puntuación y jugador IA secreto.

## 1. Supabase
Ejecuta `supabase-v1-migration.sql` en SQL Editor.

## 2. IA
Despliega `supabase/functions/unmask-ai/index.ts` como Edge Function `unmask-ai` y configura el secreto `OPENAI_API_KEY` en Supabase. La clave nunca se mete en el navegador. Supabase recomienda guardar secretos de funciones como variables de entorno.

## 3. GitHub Pages
Sube `index.html`, `app.js`, `config.js`, `styles.css` a la raíz del repositorio. La carpeta `supabase/` y el SQL son para configurar el backend.

La seguridad RLS de esta versión sigue siendo de prototipo y debe endurecerse antes de compartir públicamente.
