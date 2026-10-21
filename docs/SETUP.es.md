# Luca

*Luca* es como en Colombia se le dice a mil pesos. Esta es la app para saber en qué se van.

App de finanzas personales para Colombia: tarjetas de crédito en pesos y dólares, quincena, agenda de pagos, cuentas de ahorro, gastos por categoría, presupuestos y metas. Funciona en Android, iPhone y computador, con cuentas de usuario (correo, Google y Apple) y base de datos propia.

**Stack:** HTML + CSS + JavaScript sin frameworks · Supabase (PostgreSQL, Auth, Realtime) · PWA instalable · GitHub Pages.


## Novedades 1.2

- **Libre hasta la quincena**: cuánto puedes gastar por día hasta tu próximo pago, ya descontando lo que vence antes.
- **¿Me alcanza?**: escribes un precio y responde en verde, amarillo o rojo según tu plata, tus pagos y tu presupuesto.
- **Gastos rápidos**: tus gastos de siempre se guardan con un toque (con botón Deshacer).
- **Escribe el gasto como hablas**: "almuerzo 18 mil nequi", "uber 12.500 nubank ayer", "netflix 20 usd amex".
- **Resumen del mes animado** (tipo historias), con botón para compartir.
- **Metas animadas** con confeti al cumplirlas (y al pagar toda una tarjeta).
- **Avisos de pago**: aviso en el Resumen, notificaciones en el dispositivo y archivo de calendario (.ics) que avisa un día antes y el mismo día.
- **Libre de deudas el…**: fecha estimada para cada tarjeta y para todas, con barra para ver qué pasa si pagas más.
- **Idiomas**: español e inglés (Más → Idioma). Diccionario en `i18n-en.js`; para otro idioma se copia ese archivo.
- **Logo en un solo lugar**: `logo/logo.svg`. Para cambiarlo: `python3 herramientas/iconos.py tu-logo.png` (ver `logo/LEEME.md`).

---

## Qué cuesta

| Cosa | Precio | Notas |
|---|---|---|
| Supabase (base de datos y usuarios) | **Gratis** | 500 MB, 50.000 usuarios activos al mes. El proyecto se **pausa si pasa 1 semana sin uso**; se reactiva desde el panel. |
| GitHub Pages (hosting) | **Gratis** | El repositorio debe ser público. |
| Entrar con correo | **Gratis** | Para que le llegue el código a cualquier persona necesitas tu propio servicio de correo (paso 4). |
| Entrar con Google | **Gratis** | Se configura en Google Cloud. |
| Entrar con Apple | US$99 al año | Requiere el Apple Developer Program. Queda listo y apagado en `config.js`. |
| Google Play / App Store | US$25 una vez / US$99 al año | Solo si la subes a las tiendas (sección final). |

---

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com), crea una cuenta gratis y luego **New project**. Nombre: `luca`. Región: la más cercana (ej. *East US* o *São Paulo*). Guarda la contraseña de la base de datos.
2. Cuando termine de crearse, ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y dale **Run**. Debe decir *Success*.
3. Ve a **Project Settings → API** (o **API Keys**) y copia:
   - **Project URL** (algo como `https://abcd1234.supabase.co`)
   - la clave **anon / public** (o **publishable**). **Nunca** copies la `service_role` / `secret`.

## 2. Poner tus claves en `config.js`

Abre `config.js` y reemplaza:

```js
SUPABASE_URL: "https://abcd1234.supabase.co",
SUPABASE_ANON_KEY: "eyJhbGciOi...",   // la clave pública
```

Esa clave es pública a propósito: la seguridad la ponen las reglas de la base de datos (cada usuario solo ve sus filas).

## 3. Subir la app a internet (GitHub Pages)

1. Crea una cuenta en [github.com](https://github.com) y un repositorio **público** llamado `luca`.
2. En el repositorio: **Add file → Upload files** y arrastra **todo el contenido** de esta carpeta (incluido `.nojekyll`). **Commit changes**.
3. Ve a **Settings → Pages**. En *Source* elige **Deploy from a branch**, rama `main`, carpeta `/ (root)`. Guarda.
4. En 1–2 minutos tu app queda en `https://TU-USUARIO.github.io/luca/`.

## 4. Configurar el inicio de sesión

**Modo pruebas (así está ahora):** entrada con **correo + contraseña** y la opción *Confirm email* apagada en Supabase (Authentication → Sign In / Providers). La cuenta se crea al instante y no se envía ningún correo. Antes de lanzar, vuelve a prender *Confirm email* y configura el correo (abajo).

En Supabase: **Authentication → URL Configuration**
- **Site URL:** `https://TU-USUARIO.github.io/luca/`
- **Redirect URLs:** agrega esa misma dirección.

### Correo con código de 6 dígitos
1. **Authentication → Emails → Templates → Magic Link**. Cambia el cuerpo por algo como:
   ```html
   <h2>Tu código para entrar a Luca</h2>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>Vence en una hora. Si no lo pediste, ignora este correo.</p>
   ```
   El asunto puede ser: `Tu código de Luca`.
2. **Importante:** el correo que trae Supabase por defecto **solo envía a los miembros de tu equipo** de Supabase (o sea, a ti) y máximo 2 por hora. Sirve para probar. Para que le llegue a cualquier persona, en **Authentication → Emails → SMTP Settings** activa *Custom SMTP*. Opción gratis para empezar, con una cuenta de Gmail:
   - Activa la verificación en 2 pasos en tu Google y crea una **contraseña de aplicación** (myaccount.google.com → Seguridad → Contraseñas de aplicaciones).
   - Host `smtp.gmail.com`, puerto `587`, usuario: tu Gmail, contraseña: la contraseña de aplicación, remitente: tu Gmail.
   - Cuando tengas un dominio propio, cámbialo por un servicio de correo transaccional (Resend, Brevo, etc.) para que los correos no lleguen a spam.

### Google (gratis)
1. En [console.cloud.google.com](https://console.cloud.google.com) crea un proyecto `Luca`.
2. **APIs y servicios → Pantalla de consentimiento OAuth**: tipo *Externo*, nombre de la app, tu correo de soporte, y en dominios autorizados agrega `supabase.co` y `github.io`. Enlace de privacidad: `https://TU-USUARIO.github.io/luca/privacidad.html`. Al terminar, **publica la app** (estado *En producción*); con solo correo y perfil no necesita revisión de Google.
3. **Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web**.
   - *Orígenes de JavaScript autorizados:* `https://TU-USUARIO.github.io`
   - *URI de redireccionamiento autorizados:* `https://abcd1234.supabase.co/auth/v1/callback` (tu Project URL + `/auth/v1/callback`; Supabase te la muestra en el paso siguiente).
4. Copia el **ID de cliente** y el **Secreto**, y pégalos en Supabase: **Authentication → Sign In / Providers → Google → Enable**.

### Apple (cuando pagues el Apple Developer Program)
1. En [developer.apple.com](https://developer.apple.com) crea un **Services ID**, activa *Sign in with Apple* con el dominio `abcd1234.supabase.co` y el retorno `https://abcd1234.supabase.co/auth/v1/callback`, y crea una **Key** con *Sign in with Apple*.
2. En Supabase: **Authentication → Providers → Apple**, pega el Services ID, Team ID, Key ID y la clave `.p8`.
3. En `config.js` cambia `apple: false` por `apple: true`.

> Nota iPhone: si instalas la app en la pantalla de inicio, el inicio con Google o Apple puede abrir Safari y no volver a la app instalada. El **código por correo** funciona siempre dentro de la app. Para la versión de App Store (Capacitor) esto se resuelve con inicio de sesión nativo.

## 5. Pasar tus datos actuales

1. Entra a la app con tu correo.
2. Ve a **Más → Tu cuenta → Importar respaldo** y elige el archivo `luca-respaldo.json` que viene aparte (no lo subas a GitHub: tiene tus datos).

## 6. Instalar en el celular

- **Android (Chrome):** abre la dirección y toca **Instalar app** (o menú ⋮ → *Agregar a pantalla principal*).
- **iPhone (Safari):** botón Compartir → **Agregar a pantalla de inicio**.

## Actualizar la app

Sube los archivos cambiados al repositorio y, en `sw.js`, cambia `luca-v1` por `luca-v2` (y así cada vez). Así los celulares toman la versión nueva.

---

## Analizar los datos (Power BI / Looker Studio)

`schema.sql` crea vistas con columnas normales: `v_gastos`, `v_ingresos`, `v_pagos_tarjetas`, `v_tarjetas`, `v_cuentas`, `v_movimientos_cuentas`.
- **Power BI Desktop:** Obtener datos → *PostgreSQL*. Servidor y base de datos: en Supabase, botón **Connect** → *Session pooler*. Usuario `postgres.<id-del-proyecto>` y la contraseña del paso 1.
- Ideas de tablero: gasto por categoría y mes, gasto diario contra el ritmo, evolución de la deuda por tarjeta, % de cupo usado, ingresos vs. gastos por quincena.

## Cobrar en el futuro

La app ya trae todo lo necesario; solo falta conectar una pasarela:
- Tabla `profiles` con `plan` (`free` / `pro`) y `plan_until`. **La app no puede cambiar el plan**: solo el servidor.
- Límites por plan en `config.js` → `PLANES` (hoy todo ilimitado). Si un usuario gratis llega al límite, la app le muestra la pantalla de "Pásate a Pro".
- Botón **Mejorar a Pro** en Más → Tu cuenta, que lleva a `PAGOS.checkoutUrl` con el id del usuario (`?ref=`).
- Función `supabase/functions/payment-webhook`: la pasarela la llama cuando confirma un pago y pone al usuario en `pro`.

Pasos cuando quieras cobrar:
1. Elige una pasarela que funcione en Colombia (por ejemplo **Wompi** o **Mercado Pago**) y crea un link o checkout de suscripción.
2. Adapta `leerEvento` en `payment-webhook/index.ts` al formato de esa pasarela y verifica su firma.
3. Publica la función: `supabase functions deploy payment-webhook --no-verify-jwt` y `supabase secrets set WEBHOOK_SECRET=...`.
4. En `config.js`: `PAGOS: { activo: true, checkoutUrl: "https://tu-link-de-pago" }` y define los límites del plan gratis.

> Si la publicas en Google Play o App Store, las tiendas exigen usar **su propio sistema de pagos** para suscripciones digitales dentro de la app (con comisión). Herramientas como RevenueCat facilitan esto. Revisa las reglas vigentes antes de cobrar.

## Llevarla a Google Play y App Store (Capacitor)

Se reutiliza el mismo código, sin reescribir nada:

```bash
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
mkdir www && cp -r index.html styles.css app.js config.js sw.js manifest.webmanifest privacidad.html icons www/
npx cap init "Luca" co.miscuentas.app --web-dir www
npx cap add android      # abre con: npx cap open android  (Android Studio)
npx cap add ios          # necesita un Mac con Xcode, o un servicio de compilación en la nube
```

Requisitos de las tiendas a tener en cuenta:
- **Google Play:** cuenta de desarrollador (US$25, un solo pago). Las cuentas personales nuevas deben hacer una **prueba cerrada con al menos 12 personas durante 14 días** antes de publicar.
- **App Store:** Apple Developer Program (US$99/año). Si ofreces inicio con Google, Apple exige también **Sign in with Apple**.
- Ambas piden **política de privacidad** (ya está en `privacidad.html`; cambia `CORREO-DE-CONTACTO`) y la opción de **eliminar la cuenta** desde la app (ya está en Más → Tu cuenta).

## Archivos

```
index.html            pantalla de entrada + la app
styles.css            sistema de diseño (claro y oscuro)
app.js                lógica de la app, datos y sesión
config.js             tus claves públicas, proveedores, pagos y planes
sw.js                 modo sin conexión e instalación
manifest.webmanifest  nombre, colores e íconos de la app instalada
privacidad.html       política de privacidad
icons/                íconos
supabase/schema.sql   tablas, seguridad, planes y vistas para análisis
supabase/functions/payment-webhook/  base para activar cobros
```

---

## Estado actual (v1.1)

- App en vivo: https://andresr-7.github.io/luca/
- Android: APK en https://andresr-7.github.io/luca/descargas/Luca.apk (paquete `io.github.andresr7.luca`). La verificación para abrir sin barra del navegador está en https://andresr-7.github.io/.well-known/assetlinks.json (repo `andresr-7.github.io`).
- **La llave de firma de Android (`signing.keystore` y `signing-key-info.txt`) NO está en este repositorio.** Sin ella no se puede actualizar la app en Google Play: guárdala en un lugar seguro.
- Correo de soporte de Luca (público): luca.app.col@gmail.com. Úsalo para Brevo, Google Cloud, Google Play y pagos; nunca un correo personal.
- Entrada: correo + contraseña, código por correo, recuperación con código, verificación al crear cuenta. Google y Apple se prenden en `config.js` → `PROVEEDORES`.

### Activar códigos por correo para todos (gratis, 5 min)
1. Crea una cuenta gratis en [brevo.com](https://www.brevo.com) (300 correos al día) o usa tu Gmail con una *contraseña de aplicación*.
2. En Brevo: **SMTP & API → SMTP** y genera una clave SMTP. Verifica tu correo como remitente.
3. En Supabase: **Authentication → Emails → SMTP Settings → Enable custom SMTP**: host `smtp-relay.brevo.com`, puerto `587`, usuario y clave de Brevo, remitente tu correo verificado, nombre `Luca`.
4. En **Authentication → Emails → Templates**, en *Confirm sign up*, *Magic link or OTP* y *Reset password*, deja el cuerpo así (cambia el título en cada uno):
   ```html
   <h2>Tu código de Luca</h2>
   <p style="font-size:32px;font-weight:600;letter-spacing:6px">{{ .Token }}</p>
   <p>Vence en una hora. Si no lo pediste, ignora este correo.</p>
   ```
5. En **Authentication → Sign In / Providers** vuelve a prender **Confirm email**. La app ya pide el código al crear la cuenta.

### Activar Google (gratis, 10 min)
Sigue el paso 4 → *Google* de arriba. Al final, en `config.js` cambia `google: false` por `google: true`.
