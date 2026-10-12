# AI Studio

## Descripción
Estudio de desarrollo de software impulsado por agentes de IA.
Cada proyecto es abordado por un equipo de agentes especializados
coordinados por un orquestador central.

## Estructura del estudio
- /agents          → agentes reutilizables para cualquier proyecto
- /projects        → proyectos en desarrollo
- /projects/healthy → primer proyecto (app de salud y fitness)

## Cómo iniciar un nuevo proyecto
1. Crear carpeta en /projects/{nombre-proyecto}/
2. Crear requirements.md con la descripción del proyecto
3. Lanzar el agente orquestador apuntando al proyecto
4. El orquestador genera tasks.md y distribuye el trabajo
5. Lanzar cada agente en su carpeta correspondiente

## Agentes disponibles
- orchestrator → coordina y distribuye trabajo
- frontend     → React Native o React según el proyecto
- backend      → Node.js + Express
- database     → PostgreSQL + Prisma
- ai           → Claude API
- design       → sistema de diseño estilo Apple
- tests        → Jest + Playwright
- devops       → Docker + GitHub Actions
- security     → RGPD y auditoría
- docs         → documentación técnica y legal

## Reglas globales
- Cada agente trabaja SOLO en su carpeta asignada
- El orquestador es el único que distribuye tareas
- Todo proyecto empieza con requirements.md
- Código en inglés, comentarios en español
- Commits en conventional commits
- Todo cambio pasa por Pull Request antes de mergear a main