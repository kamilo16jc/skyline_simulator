\# 🛫 SkyLine — Guía Completa para Claude Code



> \*\*Este archivo es tu memoria principal del proyecto. Actualízalo cada vez que aprendas algo nuevo, corrijas un error, o implementes una feature.\*\*



---



\## 🗂️ Estructura del Repositorio



```

skyline\_simulator/                  ← Raíz del repo git (SSH ya configurado)

└── Airlines simulator/             ← Carpeta del proyecto Unity

&nbsp;   └── Assets/

&nbsp;       ├── Airlines Manger/        ← Assets principales del juego (sí, "Manger" con typo)

&nbsp;       │   ├── Art/

&nbsp;       │   │   ├── Aircrafts/

&nbsp;       │   │   └── Prefabs/

&nbsp;       │   ├── Resources/

&nbsp;       │   │   ├── Airports/       ← 1103 AirportData ScriptableObjects (.asset)

&nbsp;       │   │   └── Maps/

&nbsp;       │   ├── Scenes/

&nbsp;       │   │   └── SampleScene     ← Escena principal del juego (aún vacía/en construcción)

&nbsp;       │   └── Scirpts/            ← Scripts del juego (sí, "Scirpts" con typo)

&nbsp;       │       ├── core/

&nbsp;       │       ├── Data/

&nbsp;       │       ├── Economy/

&nbsp;       │       ├── Editor/

&nbsp;       │       ├── events/

&nbsp;       │       ├── Networks/

&nbsp;       │       └── UI/             ← Scripts de UI incluyendo el mapa

&nbsp;       │           ├── SkyLineMapController.cs   ← CONTROLADOR PRINCIPAL DEL MAPA

&nbsp;       │           ├── AirportInfoPanelBuilder.cs ← Crea el panel UI automáticamente

&nbsp;       │           ├── GameUI.cs

&nbsp;       │           ├── MapPlaneIcon.cs

&nbsp;       │           └── RouteLineR...cs

&nbsp;       └── WorldPoliticalMap2DEdition/  ← Asset comercial Kronnect ($69.99)

&nbsp;           └── Scripts/

&nbsp;               ├── WorldMap2D.cs

&nbsp;               ├── WorldMap2DInteraction.cs

&nbsp;               └── WorldMap2DMarkersAndLines.cs

```



---



\## 🎮 Estado Actual del Proyecto (Marzo 2026)



\### ✅ Completado

\- \*\*Phase 1\*\*: 1,245 game assets creados

\- \*\*Phase 2\*\*: Backend completo — GameManager, RouteEngine, sistemas económicos, manejo de eventos

\- \*\*Mapa mundial\*\*: WorldMap2D asset (Kronnect) integrado con textura satelital

\- \*\*1103 aeropuertos\*\*: ScriptableObjects con IATA, lat/lon, ciudad, país, clase (F/E/D/C)

\- \*\*Dots en mapa\*\*: 1103 puntos blancos en posición geográfica correcta

\- \*\*Interacción click\*\*: Click en aeropuerto muestra panel con info (IATA, nombre, ciudad, clase)

\- \*\*Panel de info\*\*: Diseño profesional con fondo oscuro, acento azul, creado automáticamente por AirportInfoPanelBuilder

\- \*\*Botón cerrar\*\*: Funciona correctamente



\### 🔄 En Progreso / Pendiente

\- Integrar escena del mapa (DemoUIPanel) con SampleScene principal

\- Conectar SkyLineMapController con GameManager y RouteEngine

\- Dibujar líneas de rutas activas del jugador

\- Avión animado moviéndose entre aeropuertos

\- UI principal del juego (menú, HUD, economía)

\- Optimización del panel para móvil (actualmente texto muy grande en builds)



---



\## 🗺️ El Mapa — Detalles Técnicos



\### Asset: World Map 2D Edition 2 (Kronnect)

\- Namespace: `WPMF`

\- Singleton: `WorldMap2D.instance`

\- Escena activa: `DemoUIPanel` (Demo 8 UI MapPanel)

\- Textura: `EarthHighRes` (satelital)



\### Coordenadas

El asset usa sistema -0.5 a 0.5:

```csharp

Vector2 mapPos = new Vector2(longitude / 360f, latitude / 180f);

```



\### API Principal

```csharp

WorldMap2D map = WorldMap2D.instance;

map.AddMarker(gameObject, new Vector3(x, y, 0), size);

map.AddLine(posA, posB, color, arcElevation, duration, lineWidth, fadeOut);

map.ClearMarkers();

map.ClearLineMarkers();

map.FlyToLocation(Vector2 pos, float duration, float zoomLevel);

map.OnClick += (Vector2 mapPosition) => { };  // Evento de click

map.showLatitudeLines = false;

map.showLongitudeLines = false;

map.showCursor = false;

```



---



\## ✈️ AirportData ScriptableObject



```csharp

// Campos disponibles en cada AirportData

public string iataCode;      // "ORD", "LAX", etc.

public string displayName;   // "O'Hare International"

public string city;          // "Chicago"

public string country;       // "USA"

public float latitude;       // 41.9742

public float longitude;      // -87.9073

public string airportClass;  // "F", "E", "D", "C"

```



\*\*Carga:\*\*

```csharp

AirportData\[] airports = Resources.LoadAll<AirportData>("Airports");

```



---



\## 📜 Scripts Clave



\### SkyLineMapController.cs

\*\*Ubicación:\*\* `Assets/Airlines Manger/Scirpts/UI/SkyLineMapController.cs`

\*\*Namespace:\*\* `SkyLine.Map`



\*\*Responsabilidades:\*\*

\- Cargar 1103 aeropuertos y crear dots en el mapa

\- Detectar clicks y encontrar el aeropuerto más cercano (radio: 0.012 unidades)

\- Mostrar/ocultar panel de info

\- Cambiar colores de dots según estado

\- Dibujar líneas de rutas



\*\*API Pública:\*\*

```csharp

controller.SetPlayerHub("ORD");              // Pinta verde

controller.DrawRoute("ORD", "LAX");          // Dibuja línea azul

controller.ClearRoutes();                    // Limpia líneas

controller.ClosePanel();                     // Cierra panel info

controller.GetDot("ORD");                    // Retorna GameObject del dot

controller.LatLonToMapPosition(lat, lon);    // Convierte coordenadas

```



\*\*Campos públicos (para AirportInfoPanelBuilder):\*\*

```csharp

public GameObject airportInfoPanel;

public TMP\_Text textAirportName;

public TMP\_Text textAirportIATA;

public TMP\_Text textAirportCity;

public TMP\_Text textAirportClass;

public Button btnClose;

```



\*\*Colores configurables en Inspector:\*\*

\- `colorUnlocked` = blanco (aeropuertos disponibles)

\- `colorPlayerHub` = verde (hub del jugador)

\- `colorActiveRoute` = azul (en ruta activa)

\- `colorLocked` = gris transparente (bloqueados)

\- `colorSelected` = amarillo (seleccionado al hacer click)



\### AirportInfoPanelBuilder.cs

\*\*Ubicación:\*\* `Assets/Airlines Manger/Scirpts/UI/AirportInfoPanelBuilder.cs`

\*\*Namespace:\*\* `SkyLine.Map`



\- Se ejecuta en `Awake()` — crea el panel antes de que `SkyLineMapController.Start()` corra

\- Crea todo el UI programáticamente (no depende de jerarquía manual)

\- Se conecta automáticamente al `SkyLineMapController` via `FindObjectOfType`

\- Tamaño responsivo: `panelW = Mathf.Min(Screen.width \* 0.4f, 300f)`



---



\## 🐛 Errores Conocidos y Sus Soluciones



| Error | Causa | Solución |

|-------|-------|----------|

| Panel de info muy grande en build | Canvas no tiene escala responsiva | Ajustar `Canvas Scaler` a `Scale With Screen Size` |

| `FlyToLocation` congela el mapa | El zoom automático bloquea inputs | \*\*Eliminado del código\*\* — no usar |

| Errores `InvalidCastException` en Editor | Incompatibilidad del asset WorldMap2D con Unity 6 | Son errores del Editor de Kronnect, no afectan gameplay |

| `NullReferenceException MountPointScaler` | Bug interno del asset | Ignorar, no afecta gameplay |

| Textos de UI no se pueden arrastrar al Inspector | El campo era `UnityEngine.UI.Text` pero Unity 6 usa TMP por defecto | Cambiar campos a `TMP\_Text` |

| Panel visible desde el inicio | `airportInfoPanel.SetActive(false)` se llama en `Start()` pero builder lo crea después | Mover creación del panel a `Awake()` en el builder |

| `DontDestroyOnLoad` mueve el controller | El controller tenía `DontDestroyOnLoad` en Awake | \*\*Eliminar\*\* ese Awake del controller |



---



\## 🏗️ Arquitectura del Juego



```

GameManager (Singleton)

&nbsp;   ├── RouteEngine          ← Maneja rutas activas

&nbsp;   ├── EconomySystem        ← Finanzas, ingresos, gastos

&nbsp;   ├── EventManager         ← Eventos random (clima, strikes, etc.)

&nbsp;   └── NetworkManager       ← Red de aeropuertos y conexiones



SkyLineMapController         ← UI del mapa mundial

&nbsp;   ├── WorldMap2D (asset)   ← Renderizado del mapa

&nbsp;   ├── 1103 AirportData     ← Base de datos de aeropuertos

&nbsp;   └── AirportInfoPanelBuilder ← Panel de información

```



---



\## 📋 Próximos Pasos (Prioridad)



1\. \*\*Integración mapa ↔ GameManager\*\*

&nbsp;  - Cuando el jugador crea una ruta: `mapController.DrawRoute(origin, dest)`

&nbsp;  - Cuando selecciona hub: `mapController.SetPlayerHub(iata)`



2\. \*\*Avión animado en rutas\*\*

&nbsp;  - Sprite de avión que se mueve entre dos puntos usando Lerp

&nbsp;  - Click en avión muestra info del vuelo activo



3\. \*\*Integrar DemoUIPanel con SampleScene\*\*

&nbsp;  - Mover la configuración del mapa a la escena principal

&nbsp;  - Eliminar dependencia de la escena Demo



4\. \*\*UI Principal del juego\*\*

&nbsp;  - Panel de economía (dinero, ingresos, gastos)

&nbsp;  - Lista de rutas activas

&nbsp;  - Menú principal



5\. \*\*Optimización móvil\*\*

&nbsp;  - `Canvas Scaler` → `Scale With Screen Size` → Reference 1920x1080

&nbsp;  - Ajustar tamaños de fuente relativos



---



\## 🔧 Setup del Entorno



\### Unity

\- \*\*Versión:\*\* Unity 6.3 LTS (6000.3.2f1)

\- \*\*Render Pipeline:\*\* Default (no URP/HDRP)

\- \*\*Platform:\*\* Windows/Mac/Linux Standalone + Android

\- \*\*Escena activa de desarrollo:\*\* `DemoUIPanel` (dentro de WorldPoliticalMap2DEdition/Demos)



\### Git

```bash

\# El repositorio ya tiene SSH configurado

cd skyline\_simulator

git status

git add -A

git commit -m "descripción del cambio"

git push origin main

```



\### Dependencias

\- \*\*TextMeshPro\*\* — importar TMP Essentials (ya hecho)

\- \*\*WorldPoliticalMap2DEdition\*\* — asset Kronnect ya importado

\- \*\*Namespaces necesarios:\*\* `using WPMF;`, `using TMPro;`, `using UnityEngine.UI;`



---



\## 📝 Instrucciones para Claude Code



\### Flujo de trabajo

1\. \*\*Siempre\*\* hacer `git pull` antes de empezar a trabajar

2\. Después de cada cambio significativo: `git add -A \&\& git commit -m "..." \&\& git push`

3\. Cuando encuentres un error y lo soluciones, agrega el error a la tabla de "Errores Conocidos"

4\. Cuando implementes algo nuevo, actualiza la sección "Estado Actual"

5\. \*\*Nunca\*\* borrar archivos sin confirmar con el usuario



\### Convenciones del proyecto

\- Namespace de scripts propios: `SkyLine.Map` (UI), `SkyLine.Core`, etc.

\- Prefijo de logs: `\[SkyLine]` para mensajes de consola

\- Typos intencionales en carpetas: "Scirpts" y "Airlines Manger" — \*\*NO corregir\*\*, rompería referencias



\### Cómo editar scripts Unity desde Claude Code

```bash

\# Los scripts están en:

skyline\_simulator/Airlines\\ simulator/Assets/Airlines\\ Manger/Scirpts/UI/



\# Editar directamente y Unity auto-detecta el cambio

\# Si Unity no recompila solo, en Unity: Assets → Refresh (Ctrl+R)

```



\### Al encontrar errores de compilación en Unity

1\. Leer el error completo en la Console de Unity

2\. Identificar el archivo y línea

3\. Corregir el script

4\. Guardar → Unity recompila automáticamente

5\. Documentar en este archivo si es un error recurrente



---



\## 🎯 Visión del Juego



\*\*SkyLine\*\* es un juego de simulación/tycoon de gestión de aerolíneas:

\- El jugador empieza con una aerolínea pequeña y presupuesto limitado

\- Compra aviones, establece rutas entre aeropuertos

\- Gestiona finanzas: costos de combustible, mantenimiento, salarios, tarifas

\- Compite contra aerolíneas IA con diferentes estrategias

\- Sistema de reputación que afecta la demanda de pasajeros

\- Eventos dinámicos: clima, huelgas, crisis económicas

\- 597-1103 aeropuertos disponibles en todo el mundo

\- Clases de aeropuertos F/E/D/C con diferentes capacidades y costos



---



\*Última actualización: Marzo 2026\*

\*Actualiza este archivo cada vez que aprendas algo nuevo sobre el proyecto.\*

