import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El modal de Pipedrive (App Extension del Developer Hub) carga /pipedrive
  // dentro de un iframe propio de Pipedrive — sin este header el navegador lo
  // bloquea y el modal queda en blanco, sin ningún error visible en la app.
  // Se limita a esta única ruta a propósito: el resto del sistema (login,
  // cotizador normal, propuestas públicas) no tiene ninguna razón para
  // dejarse enmarcar por nadie, así que no se toca su comportamiento.
  async headers() {
    return [
      {
        source: '/pipedrive/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors https://*.pipedrive.com' },
        ],
      },
    ];
  },
};

export default nextConfig;
