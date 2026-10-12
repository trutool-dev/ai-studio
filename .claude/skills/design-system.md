# Skill: Design System — Healthy App

## Cuándo aplicar este skill
Aplica este skill siempre que vayas a:
- Crear o modificar componentes de UI
- Crear nuevas pantallas
- Añadir estilos o colores
- Implementar animaciones o transiciones
- Trabajar con tipografía, espaciado o iconos

## Tokens de diseño

### Colores principales
- Primary Green:  #22C55E  → botones, progreso, éxito
- Dark Green:     #16A34A  → pressed states
- Light Green:    #DCFCE7  → fondos suaves
- White:          #FFFFFF  → fondos principales
- Off White:      #F9FAFB  → fondos secundarios
- Dark Gray:      #1F2937  → textos principales
- Medium Gray:    #9CA3AF  → textos secundarios

### Colores semánticos
- Success:  #22C55E
- Warning:  #F59E0B
- Error:    #EF4444
- Info:     #3B82F6

### Espaciado (múltiplos de 8px)
- XS: 4px  SM: 8px  MD: 16px
- LG: 24px  XL: 32px  2XL: 48px

### Tipografía
- Títulos grandes:  32px / weight 700
- Títulos medios:   24px / weight 600
- Cuerpo:           16px / weight 400
- Caption:          12px / weight 400

### Bordes
- Botones:  border-radius 14px
- Cards:    border-radius 20px
- Inputs:   border-radius 12px
- Pills:    border-radius 100px
- Modales:  border-radius 28px

### Sombras estilo Apple
- Card:    0 2px 20px rgba(0,0,0,0.06)
- Modal:   0 8px 40px rgba(0,0,0,0.12)
- Button:  0 4px 12px rgba(34,197,94,0.25)

## Componentes disponibles
Importar siempre desde:
- ../design/components/index.js (Button, Input, Card, Navigation)
- ../design/tokens/ (colors, typography, spacing)

## Reglas de diseño
- Estilo limpio y minimalista — inspiración Apple
- Fondo blanco, acentos en verde #22C55E
- Botones primarios: altura 56px, ancho completo
- Inputs: altura 56px, label flotante animado
- Soporte obligatorio para modo oscuro
- Áreas táctiles mínimas 48px (WCAG AA)
- Skeleton screens en lugar de spinners
- Animaciones máximo 300ms ease-in-out
- Haptic feedback en acciones importantes

## Modo oscuro
- Background:  #0A0A0A
- Surface:     #1A1A1A
- Border:      #2D2D2D
- Text:        #F9FAFB