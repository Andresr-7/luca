# Logo de Luca

El logo vive en **un solo archivo**: `logo/logo.svg`. La app lo usa en la pantalla de entrada, la barra de arriba,
la pantalla de carga, el resumen animado y las páginas de privacidad y términos.

Para cambiarlo por el tuyo:
1. Haz tu logo cuadrado, 1024 × 1024 px, en PNG (con su fondo y esquinas redondeadas si quieres que se vea como ícono de app).
2. Corre `python3 herramientas/iconos.py tu-logo.png`. Eso reemplaza `logo/logo.svg`, `logo/logo.png` y todos los íconos de `icons/`.
3. Sube el número de `CACHE` en `sw.js` y publica.

El logo actual es la **moneda con una porción libre**: el corte de la moneda forma una L y la porción verde es “lo que te queda libre”.

Archivos: `logo.svg` (ícono con fondo), `logo-cuadrado.svg` (sin esquinas, para Google Play), `simbolo.svg` y `simbolo-blanco.svg` (solo el símbolo, para fondos claros u oscuros).
Colores: azul `#2F6BFF` → índigo `#3A1FE0`, blanco y lima `#C6F432`.

`logo-original-1024.png` es el logo anterior (la L que sostiene una moneda).
