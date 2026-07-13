import Link from "next/link";
import { Boton } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { AlEntrarEnVista } from "@/components/al-entrar-en-vista";

const LIMITES_ANUALES = [
  { anio: 2026, horas: 48 },
  { anio: 2027, horas: 46 },
  { anio: 2028, horas: 44 },
  { anio: 2029, horas: 42 },
  { anio: 2030, horas: 40 },
];

const CAPACIDADES = [
  {
    titulo: "Fichaje personal con geocerca",
    texto:
      "Cada quien ficha desde su propio teléfono. Si no está en el lugar de trabajo, Chekly simplemente no deja fichar — sin trucos, sin \"se me olvidó marcar\".",
  },
  {
    titulo: "Modo kiosco con PIN y selfie",
    texto:
      "Una tablet en el mostrador basta para todo el equipo. PIN de 4 dígitos y una foto como evidencia de que fue esa persona — sin reconocimiento facial, solo prueba.",
  },
  {
    titulo: "Funciona sin internet",
    texto:
      "Wifi que falla, datos que se acaban a media semana: el fichaje se guarda en el teléfono al instante y se sincroniza solo en cuanto hay señal.",
  },
  {
    titulo: "Reportes listos para una inspección",
    texto:
      "CSV y PDF con hora exacta, ubicación y quién fichó — se exportan el mismo día si llega alguien de la STPS a pedirlos.",
  },
  {
    titulo: "Alertas de horas antes de que sea un problema",
    texto:
      "Un aviso cuando alguien se acerca al límite legal de la semana, no una sorpresa hasta que ya se pasó.",
  },
];

const PASOS = [
  {
    numero: "1",
    titulo: "Crea tu cuenta",
    texto: "Registra tu negocio en dos minutos. Sin tarjeta, sin compromiso.",
  },
  {
    numero: "2",
    titulo: "Agrega a tu equipo",
    texto: "Por centro de trabajo, con o sin PIN para el kiosco.",
  },
  {
    numero: "3",
    titulo: "Empiecen a fichar",
    texto: "Desde su teléfono o desde una tablet compartida en el local.",
  },
];

export default function Inicio() {
  return (
    <main className="flex flex-col">
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
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-6 pb-20 pt-8 md:grid-cols-2 md:pb-28 md:pt-16">
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
          </div>
        </div>

        {/* Mockup del fichaje real */}
        <div className="flex justify-center md:justify-end">
          <div className="w-[260px] rounded-[2.25rem] bg-ink p-3 shadow-[0_24px_48px_-16px_rgba(23,23,23,0.35)]">
            <div className="flex flex-col gap-8 rounded-[1.6rem] bg-bg px-5 py-10 text-center">
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted">Tu estado</p>
                <p className="text-2xl font-semibold text-ink">Fuera de turno</p>
              </div>
              <div className="flex min-h-12 items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-white">
                Marcar entrada
              </div>
              <div className="flex flex-col items-center gap-1 border-t border-border pt-6">
                <p className="text-xs text-muted">Sucursal Centro · a 12 m</p>
                <p className="text-xs font-medium text-primary-strong">Dentro del rango para fichar</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* La ley */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AlEntrarEnVista className="flex flex-col gap-4 text-center md:text-left">
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
      <section className="mx-auto w-full max-w-5xl px-6 py-20">
        <AlEntrarEnVista className="mb-12 text-center">
          <h2 className="text-3xl font-bold text-ink md:text-4xl">Listo el mismo día.</h2>
        </AlEntrarEnVista>
        <div className="grid gap-10 md:grid-cols-3">
          {PASOS.map((paso, i) => (
            <AlEntrarEnVista key={paso.numero} retraso={i * 100} className="flex flex-col gap-3">
              <span className="text-sm font-bold text-primary-strong">{paso.numero}</span>
              <h3 className="text-xl font-semibold text-ink">{paso.titulo}</h3>
              <p className="leading-relaxed text-muted">{paso.texto}</p>
            </AlEntrarEnVista>
          ))}
        </div>
      </section>

      {/* Capacidades */}
      <section className="bg-surface py-20">
        <div className="mx-auto max-w-4xl px-6">
          <AlEntrarEnVista className="mb-14 text-center">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Lo que hace, de verdad.</h2>
          </AlEntrarEnVista>
          <div className="flex flex-col gap-10">
            {CAPACIDADES.map((cap, i) => (
              <AlEntrarEnVista
                key={cap.titulo}
                retraso={i * 60}
                className="flex flex-col gap-2 border-b border-border pb-10 last:border-0 last:pb-0 md:flex-row md:gap-8"
              >
                <h3 className="shrink-0 text-xl font-semibold text-ink md:w-72">{cap.titulo}</h3>
                <p className="leading-relaxed text-muted">{cap.texto}</p>
              </AlEntrarEnVista>
            ))}
          </div>
        </div>
      </section>

      {/* Confianza */}
      <section className="mx-auto w-full max-w-4xl px-6 py-20 text-center">
        <AlEntrarEnVista className="flex flex-col items-center gap-4">
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
      <section className="bg-surface py-20">
        <div className="mx-auto flex max-w-md flex-col items-center gap-6 px-6 text-center">
          <AlEntrarEnVista className="flex flex-col items-center gap-6">
            <h2 className="text-3xl font-bold text-ink md:text-4xl">Un precio, sin sorpresas.</h2>
            <div className="flex flex-col items-center gap-1 rounded-lg border border-border bg-bg px-10 py-8">
              <p className="text-4xl font-bold text-ink">
                $179 <span className="text-lg font-medium text-muted">MXN / mes</span>
              </p>
              <p className="text-sm text-muted">o $1,790 MXN / año (2 meses gratis)</p>
              <p className="mt-3 text-sm font-medium text-primary-strong">Hasta 10 empleados</p>
            </div>
            <Link href="/registro" className="w-full sm:w-auto">
              <Boton type="button" anchoCompleto={false} className="w-full px-10 sm:w-auto">
                Crea tu cuenta gratis
              </Boton>
            </Link>
            <p className="text-sm text-muted">30 días de prueba. Sin tarjeta.</p>
          </AlEntrarEnVista>
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto w-full max-w-4xl px-6 py-24 text-center">
        <AlEntrarEnVista className="flex flex-col items-center gap-6">
          <h2 className="text-balance text-3xl font-bold text-ink md:text-4xl">
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
