import Script from 'next/script';

// Un Custom Modal de Pipedrive (App Extension, Developer Hub) tiene que
// inicializar el SDK de Pipedrive en los primeros ~10 segundos de cargar el
// iframe — si no lo hace, Pipedrive muestra "Something went wrong" sin
// ningún detalle, sin que la app vea ningún error. `beforeInteractive` hace
// que Next.js meta este script en el <head> del documento y lo corra antes
// de hidratar nada más — es justo lo que se necesita para no perder esa
// ventana. El guard `if (!params.get('id')) return` es obligatorio: esta
// misma página también se puede abrir fuera de Pipedrive (link directo sin
// iframe), y ahí el SDK no existe — sin el guard, esa visita se rompe.
const INIT_SDK_PIPEDRIVE = `
(function initPipedriveExtension() {
  var params = new URLSearchParams(location.search);
  if (!params.get('id')) return;
  window.__pdParams = Object.fromEntries(params.entries());
  if (typeof AppExtensionsSDK === 'undefined') {
    console.error('No cargó el SDK de Pipedrive');
    return;
  }
  var size = {
    width: Math.max(960, Math.min(1400, (screen.availWidth || 1440) - 120)),
    height: Math.max(700, Math.min(1000, (screen.availHeight || 900) - 160)),
  };
  new AppExtensionsSDK().initialize({ size })
    .then(function (sdk) { window.__pdSdk = sdk; })
    .catch(function (err) { console.error('Error inicializando el SDK', err); });
})();
`;

export default function PipedriveLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Script src="https://cdn.jsdelivr.net/npm/@pipedrive/app-extensions-sdk@0/dist/index.umd.js" strategy="beforeInteractive" />
      <Script id="pipedrive-sdk-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: INIT_SDK_PIPEDRIVE }} />
      {children}
    </>
  );
}
