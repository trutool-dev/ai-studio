# Healthy App

## Descripci�n
Healthy es una aplicaci�n m�vil de salud y bienestar personalizada mediante
IA. A diferencia de apps gen�ricas como MyFitnessPal o Hevy, Healthy adapta
cada plan al usuario desde el primer momento a trav�s de un onboarding
inteligente que recoge su complexi�n f�sica, nivel de actividad, h�bitos
y objetivo principal.

Con esa informaci�n, la IA genera un plan completamente personalizado que
combina nutrici�n y entrenamiento, se ajusta visualmente para ser f�cil
de seguir y evoluciona en tiempo real seg�n el progreso del usuario.

## Usuarios objetivo
Healthy da servicio a 4 perfiles mediante onboarding adaptativo:
- Personas con sobrepeso que quieren perder peso de forma sostenible
- J�venes que buscan ganar m�sculo y mejorar su rendimiento f�sico
- Personas mayores que quieren mantenerse activas y saludables
- Cualquier persona que quiera mejorar sus h�bitos de salud generales

## Diferenciadores clave
- IA que personaliza seg�n complexi�n, edad, peso, altura y objetivos
- Combina nutrici�n y entrenamiento en un �nico plan coherente
- Interfaz simple y visual, sin abrumar al usuario con datos
- El plan evoluciona autom�ticamente seg�n el progreso registrado
- Onboarding inteligente que determina el perfil exacto de cada usuario

## Stack tecnol�gico
- Frontend: React Native + Expo
- Backend: Node.js + Express
- Base de datos: PostgreSQL + Redis
- IA: Claude API
- Auth: Supabase
- Cloud: AWS
- CI/CD: GitHub Actions

## Estructura del proyecto
- /frontend   ? App m�vil React Native
- /backend    ? API REST Node.js
- /database   ? Esquema, migraciones y seeds
- /ai         ? Integraci�n Claude API y l�gica de personalizaci�n
- /tests      ? Tests unitarios y e2e
- /devops     ? Docker, CI/CD y despliegue
- /security   ? Auditor�a, validaciones y cumplimiento RGPD

## Memoria del proyecto

El archivo `ORCHESTRATOR_STATUS.log` es la memoria persistente del proyecto.
Al inicio de cada sesión de trabajo, leerlo para obtener el punto de situación.
Al final de cada sesión, añadir una entrada con:
- Fecha de la sesión
- Trabajo realizado
- Estado actualizado de criterios de go-live
- Bloqueos activos y próximas acciones

## Reglas generales para todos los agentes
- C�digo en ingl�s, comentarios en espa�ol
- Commits en formato conventional commits (feat:, fix:, docs:, etc.)
- Nunca modificar archivos fuera de tu carpeta asignada
- Antes de implementar, revisar si existe algo similar ya creado
- Toda funcionalidad nueva necesita su test correspondiente
- Los datos de salud del usuario son sensibles, tratar con RGPD en mente

## Flujo de ramas
- main        ? producci�n
- develop     ? integraci�n
- feature/frontend   ? agente frontend
- feature/backend    ? agente backend
- feature/database   ? agente base de datos
- feature/ai         ? agente IA
- feature/tests      ? agente tester
- feature/devops     ? agente devops
- feature/security   ? agente seguridad
