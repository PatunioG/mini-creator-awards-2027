# MINI CREATOR AWARDS 2027

## Archivos principales
- `index.html`, `styles.css`, `app.js`: sitio y experiencia de cuentas.
- `supabase-config.js`: URL y publishable key del proyecto.
- `supabase_setup.sql`: tablas, políticas RLS y creación automática de perfiles.

## Activar Supabase
1. Entra al proyecto MCA 2027 en Supabase.
2. Abre **SQL Editor → New query**.
3. Copia y ejecuta TODO el contenido de `supabase_setup.sql`.
4. En **Authentication → URL Configuration**, agrega la URL de tu web a Site URL y Redirect URLs. Para pruebas locales puedes usar `http://localhost:5500/**`.
5. En **Authentication → Providers → Email**, revisa si la confirmación por correo está activada. Si lo está, los usuarios deberán confirmar su correo antes de iniciar sesión.
6. Publica los archivos de esta carpeta en tu repositorio de GitHub Pages.

## Qué funciona en esta versión
- Crear cuenta con correo y contraseña.
- Iniciar y cerrar sesión.
- Guardar username y nombre para mostrar en `profiles`.
- Mantener sesión al volver a abrir la página.
- Tabla separada para administradores, sin permitir que los usuarios se asignen ese rol.

## Seguridad importante
- `supabase-config.js` contiene la publishable key, que puede estar en el navegador. La seguridad depende de las políticas RLS del SQL.
- Nunca uses ni publiques una `service_role` o secret key.
- No compartas contraseñas.
- El panel de administración, nominaciones y votaciones todavía NO están implementados. Esta entrega es la primera etapa: cuentas y perfiles.
