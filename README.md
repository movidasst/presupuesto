# Presupuesto Corporativo · Academia Movida SST

Aplicación B2B para cotizar, personalizar, generar y enviar propuestas de capacitación corporativa en Seguridad y Salud en el Trabajo.

**Producción:** https://presupuesto.movidasst.com/

## Arquitectura

- **GitHub Pages:** landing B2B, cotizador, navegación mobile-first y panel administrativo.
- **Supabase:** fuente única de configuración comercial, validación de precios, catálogo corporativo, historial/rollback y endpoint de propuestas.
- **Moodle:** categoría `27 · Cursos corporativos`, consultada mediante endpoint de solo lectura.
- **Google Apps Script:** generación transaccional del PDF, registro CRM y correos.
- **Google Drive:** plantilla maestra, PDFs privados y CRM de prospectos.

## Flujo de una propuesta

1. El prospecto calcula participantes y cursos sin entregar datos personales.
2. Después del resultado completa empresa, contacto, país, WhatsApp y correo.
3. Puede escoger cursos desde Moodle, indicar otro tema o dejarlo por definir mediante DNF.
4. Supabase vuelve a calcular el importe usando la configuración vigente; el navegador nunca decide el precio oficial.
5. Apps Script copia la plantilla de Google Docs, reemplaza variables y genera el PDF.
6. El PDF se guarda de forma privada en Drive.
7. El CRM registra el prospecto y la referencia idempotente.
8. El cliente recibe el PDF adjunto y `info@movidasst.com` recibe el aviso interno.

## Pricing progresivo

Tarifa acumulativa por tramos, no tarifa plana para toda la cohorte:

- Cohorte Base: participantes 1–11 a USD 7 por plaza/curso.
- Cohorte Corporativa: plazas 12–49 adicionales a USD 5.
- Cohorte Escala: plazas 50–99 adicionales a USD 4.
- Gran Cohorte: plazas 100+ adicionales a USD 3.

Ejemplos de control: 11 = USD 77; 12 = USD 82; 49 = USD 267; 50 = USD 271; 99 = USD 467; 100 = USD 470 por curso.

No existe monto mínimo de contratación.

## DNF

- Desde 12 participantes: **DNF básica**.
- Desde 50 participantes: **DNF ampliada**, con planificación según escala.

## Demo Corporativo

- Duración administrable; valor actual: 30 días.
- Máximo actual: 20 participantes.
- Temas corporativos respaldados en configuración y sincronizados con Moodle cuando está disponible.
- Bonus: Plan Familiar de Emergencias, fuera del número de cursos facturados.

## Archivos principales

- `index.html`: experiencia pública, cotizador y PDF local de impresión.
- `presupuesto-config.js`: configuración pública, pricing y sincronización DOM.
- `presupuesto-leads.js`: catálogo, formulario, atribución, envío y estado del backend.
- `admin.html`: panel protegido para configuración, historial y rollback.
- `integrations/apps-script-corporate-quote.gs`: módulo Apps Script instalado en el proyecto de correo existente.
- `tests/validate_project.py`: pruebas de pricing, integridad y regresiones.

## Seguridad e integridad

- El Admin usa Supabase Auth y valida rol administrativo mediante RPC.
- La configuración pública es de solo lectura.
- La configuración formal debe estar disponible en Supabase antes de habilitar el envío.
- El servidor recalcula precios y no acepta totales calculados por el cliente.
- El endpoint de propuestas incluye honeypot, tiempo mínimo de formulario e idempotencia.
- El PDF de Drive no se publica; el cliente lo recibe adjunto.
- El Apps Script reserva cuota de correo para mensajes esenciales de registro.
- Cada medio de pago está limitado a 150 caracteres para proteger la maquetación del PDF.

## PDF

La propuesta canónica enviada por correo se genera desde Google Docs y se conserva en Drive. La impresión del navegador es una copia local complementaria.

La plantilla mantiene dos páginas lógicas. El panel Admin y el servidor aplican límites de longitud para evitar desbordamientos accidentales.

## Validación automática

Cada `push` o `pull_request` ejecuta `.github/workflows/validate.yml`, que comprueba:

- sintaxis de JavaScript;
- estructura básica de HTML;
- pricing en fronteras 11→12, 49→50 y 99→100;
- monotonía del precio acumulado;
- configuración de pagos segura para PDF;
- integración de `#para-quien` en la SPA móvil;
- ausencia de infraestructura temporal de parcheo.

## Operación

Para cambiar tarifas, Demo, beneficios, condiciones o medios de pago se utiliza `admin.html`; no se editan manualmente los precios en `index.html`.

La URL desplegada de Apps Script debe mantenerse estable. Cuando se modifica el módulo, se actualiza la **implementación web existente**, no se crea otra URL.

## Licencia

GNU Affero General Public License v3.0. Consulta `LICENSE`.
