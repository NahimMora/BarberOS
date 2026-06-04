# CLAUDE.md

> Las reglas del proyecto son canónicas en `AGENTS.md`. Este archivo las importa y agrega lo específico de Claude Code.

@AGENTS.md

---

## Específico de Claude Code

- **Plan Mode siempre antes de cada fase.** Leer `docs/PRD.md`, proponer el plan de la fase, **esperar aprobación** y recién entonces implementar. No escribir código sin plan aprobado.

- **Reservá esta sesión para lo difícil.** Claude Code (Opus) se usa para arquitectura, el **motor de agenda + anti doble-reserva**, y la lógica de **caja y comisiones**. El trabajo repetitivo de UI, formularios y CRUD de pantallas se delega a **Codex** (que lee `AGENTS.md`). Regla: si un error rompe la plata o los turnos → Claude Code; si es "hacé esta pantalla" → Codex.

- **Cuidá la ventana de uso.** No explorar el repo de más ni leer archivos irrelevantes. Ir directo al PRD y a los archivos de la fase actual. Pedir antes de hacer refactors amplios no solicitados.

- **Cierre de tarea:** antes de marcar algo como terminado, correr `lint`, `typecheck` y `test`. Si alguno falla, arreglarlo antes de continuar.

- **Sub-agentes:** los de investigación/lectura no escriben; solo los implementadores escriben. No lanzar trabajo en paralelo que pueda pisar archivos de la misma fase.

- **Una fase, un objetivo.** No adelantar trabajo de fases siguientes "de paso".
