import Link from "next/link";
import { Boton } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { AlEntrarEnVista } from "@/components/al-entrar-en-vista";
import {
  IconoUbicacion,
  IconoTablet,
  IconoSinInternet,
  IconoReporte,
  IconoAlerta,
  IconoUsuarioMas,
  IconoEquipo,
  IconoCheck,
  IconoEscudo,
  IconoBalanza,
  IconoWhatsApp,
} from "@/components/iconos-landing";

const WHATSAPP_URL =
  "https://wa.me/529514082852?text=" +
  encodeURIComponent("Hola, vi Chekly y me interesa saber más para mi negocio.");

const PLANES = [
  {
    precio: "$179",
    anual: "o $1,790 MXN / año (2 meses gratis)",
    rango: "Hasta 10 empleados",
  },
  {
    precio: "$349",
    anual: "o $3,490 MXN / año (2 meses gratis)",
    rango: "Hasta 25 empleados",
  },
];

const LIMITES_ANUALES = [
  { anio: 2026, horas: 48 },
  { anio: 2027, horas: 46 },
  { anio: 2028, horas: 44 },
  { anio: 2029, horas: 42 },
  { anio: 2030, horas: 40 },
];

const CAPACIDADES = [
  {
    Icono: IconoUbicacion,
    titulo: "Fichaje personal con geocerca",
    texto:
      "Cada quien ficha desde su propio teléfono. Si no está en el lugar de trabajo, Chekly simplemente no deja fichar — sin trucos, sin \"se me olvidó marcar\".",
  },
  {
    Icono: IconoTablet,
    titulo: "Modo kiosco con PIN y selfie",
    texto:
      "Una tablet en el mostrador basta para todo el equipo. PIN de 4 dígitos y una foto como evidencia de que fue esa persona — sin reconocimiento facial, solo prueba.",
  },
  {
    Icono: IconoSinInternet,
    titulo: "Funciona sin internet",
    texto:
      "Wifi que falla, datos que se acaban a media semana: el fichaje se guarda en el teléfono al instante y se sincroniza solo en cuanto hay señal.",
  },
  {
    Icono: IconoReporte,
    titulo: "Reportes listos para una inspección",
    texto:
      "CSV y PDF con hora exacta, ubicación y quién fichó — se exportan el mismo día si llega alguien de la STPS a pedirlos.",
  },
  {
    Icono: IconoAlerta,
    titulo: "Alertas de horas antes de que sea un problema",
    texto:
      "Un aviso cuando alguien se acerca al límite legal de la semana, no una sorpresa hasta que ya se pasó.",
  },
];

const PASOS = [
  {
    Icono: IconoUsuarioMas,
    numero: "1",
    titulo: "Crea tu cuenta",
    texto: "Registra tu negocio en dos minutos. Sin tarjeta, sin compromiso.",
  },
  {
    Icono: IconoEquipo,
    numero: "2",
    titulo: "Agrega a tu equipo",
    texto: "Por centro de trabajo, con o sin PIN para el kiosco.",
  },
  {
    Icono: IconoCheck,
    numero: "3",
    titulo: "Empiecen a fichar",
    texto: "Desde su teléfono o desde una tablet compartida en el local.",
  },
];

const SECTORES = [
  {
    imagen: "https://images.unsplash.com/photo-1639087407399-0f8cfdac56cf",
    alt: "Cocinero preparando comida en la cocina de un negocio de comida",
    titulo: "Fondas y taquerías",
  },
  {
    imagen: "https://images.unsplash.com/photo-1615906655593-ad0386982a0f",
    alt: "Mecánico trabajando en el motor de un coche en su taller",
    titulo: "Talleres mecánicos",
  },
  {
    imagen: "https://images.unsplash.com/photo-1742106849926-44b5f7b9a4ef",
    alt: "Dueño de pie dentro de su pequeña tienda de conveniencia",
    titulo: "Tiendas y comercios",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Chekly",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web, Android, iOS",
  description:
    "Reloj checador digital para micro y pequeñas empresas mexicanas. Registra entradas, salidas y descansos con geocerca, PIN y selfie, cumple con el artículo 132 fracción XXXIV de la Ley Federal del Trabajo, y genera reportes listos para una inspección de la STPS.",
  url: "https://reloj-checador-chi.vercel.app",
  offers: [
    {
      "@type": "Offer",
      price: "179",
      priceCurrency: "MXN",
      priceValidUntil: "2027-12-31",
      description: "Tarifa plana mensual, hasta 10 empleados. 30 días de prueba, sin tarjeta.",
    },
    {
      "@type": "Offer",
      price: "349",
      priceCurrency: "MXN",
      priceValidUntil: "2027-12-31",
      description: "Tarifa plana mensual, hasta 25 empleados. 30 días de prueba, sin tarjeta.",
    },
  ],
  areaServed: {
    "@type": "Country",
    name: "México",
  },
  inLanguage: "es-MX",
};

export default function Inicio() {
  return (
    <main className="flex flex-col">
      {/* Datos estructurados para buscadores y motores de IA — ayuda a que
          Chekly se identifique correctamente como software de cumplimiento
          de asistencia para PyMEs mexicanas, no un genérico "app de RH". */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Logo ancho={110} className="md:hidden" />
        <Logo ancho={130} className="hidden md:block" />
        <nav className="flex items-center gap-4">
          <Link href="/login" className="hidden text-sm font-medium text-ink hover:text-primary sm:block">
            Iniciar sesión
          </Link>
          <Link href="/registro">
            <Boton type="button" anchoCompleto={false} className="px-5 text-sm">
              Crear cuenta
            </Boton>
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid min-h-[calc(100dvh-88px)] w-full max-w-6xl items-center gap-12 overflow-hidden px-6 py-12 md:grid-cols-2">
        {/* Fondo con un toque humano — object-cover recorta esta foto por
            los lados (el letrero de la taquería queda pegado al borde),
            así que un solo óvalo CENTRADO y con margen generoso respecto
            a los cuatro bordes es lo único que garantiza que nunca asome
            un fragmento cortado del letrero, sin importar el viewport. Un
            óvalo descentrado (p. ej. hacia el mockup del teléfono) corre
            el riesgo de revelar justo la zona recortada — ya pasó una vez. */}
        <div className="absolute inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1747835680062-94a22ca03ba7?auto=format&fit=crop&w=1800&q=80"
            alt="Fachada de una taquería mexicana con dos empleados atendiendo el mostrador"
            className="h-full w-full object-cover opacity-45"
            loading="eager"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 34% 36% at 50% 52%, transparent 0%, var(--color-bg) 100%)",
            }}
          />
        </div>

        <div className="flex flex-col gap-6 text-center md:text-left">
          <h1
            className="text-balance font-bold text-ink"
            style={{ fontSize: "clamp(2.25rem, 4.5vw + 1rem, 3.75rem)", letterSpacing: "-0.03em", lineHeight: 1.08 }}
          >
            El checador que deja tu negocio en regla.
          </h1>
          <p className="text-pretty text-lg leading-relaxed text-muted md:text-xl">
            Chekly registra entradas, salidas y descansos con geocerca, PIN y selfie. Funciona sin
            internet y genera el reporte que pide una inspección de la STPS.
          </p>
          <div className="flex flex-col items-center gap-3 md:items-start">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Link href="/registro" className="w-full sm:w-auto">
                <Boton type="button" anchoCompleto={false} className="w-full px-8 sm:w-auto">
                  Crea tu cuenta gratis
                </Boton>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <Boton type="button" variante="secundario" anchoCompleto={false} className="w-full px-8 sm:w-auto">
                  Ya tengo cuenta
                </Boton>
              </Link>
            </div>
            <p className="text-sm text-muted">30 días de prueba. Sin tarjeta.</p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink underline decoration-muted underline-offset-4 hover:text-primary hover:decoration-primary"
            >
              <IconoWhatsApp className="h-4 w-4" />
              ¿Dudas? Escríbenos por WhatsApp
            </a>
          </div>
        </div>

        {/* Mockup del fichaje real, proporción real de teléfono (9:19.5) */}
        <div className="flex justify-center md:justify-end">
          <div className="relative aspect-[9/19.5] w-[260px] rounded-[2.75rem] bg-ink p-[10px] shadow-[0_30px_60px_-20px_rgba(23,23,23,0.4)]">
            {/* Botones laterales */}
            <div className="absolute -left-[2px] top-24 h-8 w-[3px] rounded-l-sm bg-ink" />
            <div className="absolute -left-[2px] top-36 h-12 w-[3px] rounded-l-sm bg-ink" />
            <div className="absolute -right-[2px] top-32 h-16 w-[3px] rounded-r-sm bg-ink" />

            <div className="relative flex h-full flex-col overflow-hidden rounded-[2.15rem] bg-bg">
              {/* Notch */}
              <div className="absolute left-1/2 top-0 z-10 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-ink" />

              <div className="flex flex-1 flex-col items-center justify-center gap-8 px-5 text-center">
                <div className="flex flex-col items-center gap-1">
                  <p className="text-sm text-muted">Tu estado</p>
                  <p className="text-2xl font-semibold text-ink">Fuera de turno</p>
                </div>
                <div className="flex min-h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-white">
                  Marcar entrada
                </div>
                <div className="flex flex-col items-center gap-1 border-t border-border pt-6">
                  <p className="text-xs text-muted">Sucursal Centro · a 12 m</p>
                  <p className="text-xs font-medium text-primary-strong">Dentro del rango para fichar</p>
                </div>
              </div>

              {/* Home indicator */}
              <div className="mb-2 flex justify-center pb-1">
                <div className="h-1 w-24 rounded-full bg-ink/80" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quién lo usa */}
      <section className="flex min-h-dvh flex-col justify-center bg-surface py-20">
        <div className="mx-auto w-full max-w-6xl px-6">
          <AlEntrarEnVista className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Hecho para negocios como el tuyo.</h2>
            <p className="mx-auto mt-3 max-w-xl text-lg text-muted">
              No para una startup. Para el negocio que ya conoces.
            </p>
          </AlEntrarEnVista>
          <div className="grid gap-6 md:grid-cols-3">
            {SECTORES.map((sector, i) => (
              <AlEntrarEnVista key={sector.titulo} retraso={i * 100}>
                <div className="group relative aspect-[4/5] overflow-hidden rounded-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`${sector.imagen}?auto=format&fit=crop&w=800&h=1000&q=80`}
                    alt={sector.alt}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/0 to-ink/0" />
                  <p className="absolute bottom-5 left-5 text-lg font-semibold text-white">{sector.titulo}</p>
                </div>
              </AlEntrarEnVista>
            ))}
          </div>
        </div>
      </section>

      {/* La ley */}
      <section className="flex min-h-dvh flex-col justify-center bg-bg py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AlEntrarEnVista className="flex flex-col gap-4 text-center md:text-left">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary-strong md:mx-0">
              <IconoBalanza className="h-7 w-7" />
            </div>
            <h2 className="text-3xl font-bold text-ink md:text-4xl">La ley ya no da tregua.</h2>
            <p className="max-w-2xl text-lg leading-relaxed text-ink md:text-left">
              Desde el 1 de mayo de 2026, la Ley Federal del Trabajo exige llevar un registro
              electrónico de entradas, salidas y descansos (artículo 132, fracción XXXIV). Y la
              jornada máxima se reduce cada año hasta llegar a 40 horas en 2030.
            </p>
          </AlEntrarEnVista>

          <AlEntrarEnVista retraso={150} className="mt-10">
            <div className="flex flex-wrap justify-center gap-3 md:justify-start">
              {LIMITES_ANUALES.map((limite) => (
                <div
                  key={limite.anio}
                  className="flex min-w-24 flex-col items-center gap-1 rounded-md border border-border bg-bg px-4 py-3"
                >
                  <span className="text-xs font-medium text-muted">{limite.anio}</span>
                  <span className="text-2xl font-bold text-primary-strong">{limite.horas} h</span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted md:text-left">
              Chekly ya trae esos límites cargados y se actualizan solos cada año — tú no tienes que
              estar al pendiente.
            </p>
          </AlEntrarEnVista>
        </div>
      </section>

      {/* Cómo funciona */}
      <section className="flex min-h-dvh flex-col justify-center bg-surface py-20">
        <div className="mx-auto w-full max-w-5xl px-6">
          <AlEntrarEnVista className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Listo el mismo día.</h2>
          </AlEntrarEnVista>
          <div className="grid gap-10 md:grid-cols-3">
            {PASOS.map((paso, i) => (
              <AlEntrarEnVista key={paso.numero} retraso={i * 100} className="flex flex-col gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
                  <paso.Icono className="h-7 w-7" />
                </div>
                <span className="text-sm font-bold text-primary-strong">{paso.numero}</span>
                <h3 className="text-xl font-semibold text-ink">{paso.titulo}</h3>
                <p className="leading-relaxed text-muted">{paso.texto}</p>
              </AlEntrarEnVista>
            ))}
          </div>
        </div>
      </section>

      {/* Capacidades */}
      <section className="flex min-h-dvh flex-col justify-center bg-bg py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AlEntrarEnVista className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Lo que hace, de verdad.</h2>
          </AlEntrarEnVista>
          <div className="flex flex-col gap-10">
            {CAPACIDADES.map((cap, i) => (
              <AlEntrarEnVista
                key={cap.titulo}
                retraso={i * 60}
                className="flex flex-col gap-3 border-b border-border pb-10 last:border-0 last:pb-0 md:flex-row md:items-start md:gap-6"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
                  <cap.Icono className="h-6 w-6" />
                </div>
                <div className="flex flex-col gap-1 md:flex-row md:gap-8">
                  <h3 className="shrink-0 text-xl font-semibold text-ink md:w-64">{cap.titulo}</h3>
                  <p className="leading-relaxed text-muted">{cap.texto}</p>
                </div>
              </AlEntrarEnVista>
            ))}
          </div>
        </div>
      </section>

      {/* Imagen: fichaje personal en la vida real */}
      <section className="relative flex min-h-dvh items-end overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1737162826585-5a797ea6aedc?auto=format&fit=crop&w=1800&q=80"
          alt="Trabajador revisando su teléfono antes de empezar su turno en la cocina"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-ink/0" />
        <AlEntrarEnVista className="relative w-full px-6 pb-20 pt-40">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-balance text-2xl font-semibold text-white md:text-3xl">
              Un toque al llegar. Un toque al salir. Nada más que recordar.
            </p>
          </div>
        </AlEntrarEnVista>
      </section>

      {/* Confianza */}
      <section className="flex min-h-dvh flex-col justify-center bg-bg px-6 py-20 text-center">
        <AlEntrarEnVista className="mx-auto flex max-w-4xl flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-tint text-primary-strong">
            <IconoEscudo className="h-7 w-7" />
          </div>
          <h2 className="text-3xl font-bold text-ink md:text-4xl">
            La confianza no se declara, se demuestra.
          </h2>
          <p className="max-w-2xl text-lg leading-relaxed text-muted">
            Cada fichaje queda con hora exacta, ubicación y quién lo hizo — con la hora en la que se
            tocó el botón y la hora en la que llegó al servidor, para que un fichaje sincronizado
            tarde nunca se confunda con uno hecho tarde. Nada se puede alterar después.
          </p>
        </AlEntrarEnVista>
      </section>

      {/* Precio */}
      <section className="flex min-h-dvh flex-col justify-center bg-surface py-20">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 px-6 text-center">
          <AlEntrarEnVista className="flex flex-col items-center gap-8">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Un precio, sin sorpresas.</h2>
            <div className="grid gap-6 sm:grid-cols-2">
              {PLANES.map((plan) => (
                <div
                  key={plan.rango}
                  className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg px-10 py-8"
                >
                  <p className="text-4xl font-bold text-ink">
                    {plan.precio} <span className="text-lg font-medium text-muted">MXN / mes</span>
                  </p>
                  <p className="text-sm text-muted">{plan.anual}</p>
                  <p className="mt-3 text-sm font-medium text-primary-strong">{plan.rango}</p>
                </div>
              ))}
            </div>
            <Link href="/registro" className="w-full sm:w-auto">
              <Boton type="button" anchoCompleto={false} className="w-full px-10 sm:w-auto">
                Crea tu cuenta gratis
              </Boton>
            </Link>
            <p className="text-sm text-muted">30 días de prueba. Sin tarjeta.</p>
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:border-primary hover:text-primary-strong"
            >
              <IconoWhatsApp className="h-4 w-4" />
              ¿Más de 25 empleados? Pregúntanos por WhatsApp
            </a>
          </AlEntrarEnVista>
        </div>
      </section>

      {/* CTA final */}
      <section className="relative flex min-h-[70dvh] items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1551888797-ec22463d8461?auto=format&fit=crop&w=1800&q=80"
          alt="Dueño de un negocio sonriendo mientras trabaja"
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-ink/75" />
        <AlEntrarEnVista className="relative flex flex-col items-center gap-6 px-6 py-24 text-center">
          <h2 className="text-balance max-w-2xl text-3xl font-bold text-white md:text-4xl">
            Ponte en regla hoy, no el día de la inspección.
          </h2>
          <Link href="/registro" className="w-full sm:w-auto">
            <Boton type="button" anchoCompleto={false} className="w-full px-10 sm:w-auto">
              Crea tu cuenta gratis
            </Boton>
          </Link>
        </AlEntrarEnVista>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-6 py-10 text-center md:flex-row md:justify-between md:text-left">
          <Logo ancho={100} />
          <p className="text-sm text-muted">Registro de asistencia para negocios mexicanos.</p>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-muted hover:text-primary">
              Iniciar sesión
            </Link>
            <Link href="/registro" className="text-muted hover:text-primary">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
