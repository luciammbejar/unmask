# Unmask V0.2

Primera versión conectada a Supabase para probar partidas desde varios dispositivos.

## Antes de abrir la web
1. En Supabase abre SQL Editor.
2. Ejecuta `supabase-policies.sql`.
3. Mantén las tablas Realtime de `players`, `messages` y `questions` activas.

## Probar
Puedes abrir `index.html` directamente para comprobar la interfaz, pero para la prueba real conviene publicarlo en GitHub Pages o Vercel.

La clave incluida en `config.js` es una **Publishable Key**, diseñada para aparecer en aplicaciones web. Aun así, la seguridad real de Unmask se reforzará antes de producción.

## Próximo paso
- Publicar el frontend.
- Probar dos móviles en la misma sala.
- Mejorar el sistema de identidad/números para que sean realmente privados.
- Añadir IA para generar preguntas por categoría.
- Añadir jugador IA secreto.
- Implementar votaciones y puntuación reales.
