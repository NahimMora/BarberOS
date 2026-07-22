# Métricas — BarberOS

> Esta categoría de documento suele pensarse para productos de
> publicación/distribución de contenido (publicaciones diarias, CTR,
> alcance social). BarberOS es un sistema operativo interno de una
> barbería, así que varias de esas categorías no aplican directamente.
> Acá se adaptan a lo que sí es equivalente en este negocio, y se marca
> explícitamente lo que no aplica y por qué.

## Qué se mide hoy (dentro de la app)

El único lugar donde hoy se ven métricas es `/dashboard` (rol-aware),
calculado en el momento contra Postgres — no hay data warehouse ni BI
separado:

- Ingresos del día/mes por sucursal y globales (admin).
- Cantidad de ventas.
- Estado de caja (abierta/cerrada, diferencia).
- Comisiones a pagar por barbero/período.
- Vista barbero: sus propios cortes, ingresos generados, comisión
  acumulada.

## Equivalentes operativos (no instrumentados como serie histórica)

| Métrica genérica | Equivalente en BarberOS | Estado |
|---|---|---|
| Publicaciones diarias | Turnos agendados / completados por día | Calculable con una query directa; no hay gráfico de tendencia |
| % de publicaciones exitosas | % turnos `completed` vs `cancelled`/`no_show` | Visible por turno individual, no agregado como métrica |
| Fallos por plataforma | Errores por endpoint (`/api/sales`, `/api/cash-*`, etc.) | Parcial — `system_events` registra algunos casos, no todos (ver `docs/CURRENT_STATE.md`) |
| Tiempo manual ahorrado | Vs. planilla/WhatsApp/papel previo | No instrumentado — sería una estimación cualitativa, no un dato del sistema |
| Visitas / CTR / alcance social | — | **No aplica.** No es un producto de contenido ni tiene presencia pública/social (ver `docs/PRODUCT.md` § qué no resuelve) |
| Ingresos | Total facturado (ventas `paid`) por sucursal/período | Sí, disponible en `/dashboard` y `/comisiones` |

## Qué falta para que esto sea una serie histórica real

Ninguna de estas métricas se snapshotea hoy en un lugar donde se pueda
ver tendencia en el tiempo — solo el estado actual vía queries directas.
La fuente de datos ya existe (`sales`, `appointments`, `commissions`,
`domain_events`), así que agregar esto no requeriría cambios de schema,
solo un job o vista que las capture periódicamente. No se construyó
porque no es parte del MVP (`AGENTS.md` — regla de los 4 trabajos: no se
agrega lo que no sirve directamente a agendar/cobrar/cerrar caja/calcular
comisiones), no porque falte la data.
