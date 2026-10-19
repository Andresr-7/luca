/* Configuración de Luca.
   Esta clave es PÚBLICA a propósito (Supabase la llama "anon" o "publishable"): la seguridad la ponen las reglas
   de la base de datos (Row Level Security), que solo dejan a cada usuario ver y cambiar sus propios datos.
   NUNCA pegues aquí la clave "service_role" o "secret". */
window.CONFIG = {
  SUPABASE_URL: "https://urlfdhmksnfnlaqnnemc.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVybGZkaG1rc25mbmxhcW5uZW1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI0MjkyMzEsImV4cCI6MjEwODAwNTIzMX0.YBqncsDiE_5LX1NY4_ctVDAQYvmECxi9-22g0tAy3BQ",

  // Botones de inicio de sesión. Google: ponlo en true cuando esté activado en Supabase (README, paso 4). Apple necesita la cuenta de Apple Developer (US$99 al año): déjalo en false hasta tenerla.
  PROVEEDORES: { google: false, apple: false },

  // Cobros: déjalo apagado hasta tener una pasarela de pago (ver README, sección "Cobrar en el futuro").
  PAGOS: { activo: false, checkoutUrl: "" },

  // Límites por plan. null = sin límite. Ejemplo para el futuro: free: { tarjetas: 3, cuentas: 2, metas: 1 }
  PLANES: {
    free: { tarjetas: null, cuentas: null, metas: null },
    pro:  { tarjetas: null, cuentas: null, metas: null }
  }
};
