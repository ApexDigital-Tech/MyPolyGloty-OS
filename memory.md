# Memory & System Status: MyPolyGloty OS

**Fecha de última actualización:** 19 de octubre de 2026 (Sesión de Cierre de Sprint & Autenticación)

---

## 1. Resumen Ejecutivo y Estado Actual
**MyPolyGloty OS** ha alcanzado el hito de **Producción y Pruebas de Campo**. El sistema cuenta con:
1. Una interfaz conversacional inmersiva inspirada en Praktika (modo oscuro/claro, 100% responsiva para móvil y escritorio).
2. Modo conversacional interactivo completo: chat de texto + micrófono STT en tiempo real, velocidad de voz calibrable (0.7x a 1.0x), subtítulos con micro-traducciones en español y sugerencias de respuesta opcionales y regenerables.
3. Tutor IA pedagógico facilitador con calibración por niveles CEFR (A1 a C2).
4. **Sistema de Autenticación, Registro y Perfil de Usuario** (Dual Engine: Supabase Cloud + Local-First resiliente).
5. **Métricas de Avance y Progreso** (Racha de días 🔥, XP acumulado, turnos completados, desglose de fluidez, vocabulario y gramática).
6. **Memoria Continua del Tutor** (`user_memory`): Detección automática de hechos e intereses del alumno y saludos dinámicos personalizados.
7. Despliegue continuo en la nube (GitHub + Render + Supabase).

---

## 2. Infraestructura y Despliegue

| Componente | Servicio / Proveedor | Enlace / Identificador | Estado |
|---|---|---|:---:|
| **Repositorio Código** | GitHub | [ApexDigital-Tech/MyPolyGloty-OS](https://github.com/ApexDigital-Tech/MyPolyGloty-OS.git) | ✅ Activo (`main`) |
| **Producción Web** | Render Cloud Hosting | `https://mypolygloty-os.onrender.com/` | ✅ Desplegado (Auto-Deploy) |
| **Base de Datos & Auth** | Supabase Cloud | `https://rgnkwfgeivgfvqwcyiow.supabase.co` | ✅ Tablas y RLS listas |
| **Desarrollo Local** | Vite Dev Server | `http://localhost:5173/` | ✅ Operativo |

---

## 3. Arquitectura del Módulo de Autenticación y Progreso

### 3.1. Dual Engine Resiliente (`src/services/authService.ts`)
- **Modo Supabase Cloud**: Si las credenciales y conectividad con Supabase están activas, utiliza `supabase.auth.signUp`, `supabase.auth.signInWithPassword`, y persistencia en tablas PostgreSQL remotas.
- **Modo Local-First Fallback**: Si no hay conexión o se prueba sin variables de entorno cloud, opera de forma 100% autónoma en `localStorage`, garantizando que ningún usuario o tester quede bloqueado durante las pruebas de campo.
- **Sincronización Transparente**: Al reconectarse a Supabase, sincroniza automáticamente el progreso y la memoria local con la base de datos remota.

### 3.2. Esquema de Base de Datos (`supabase/schema.sql`)
1. **`public.profiles`**:
   - `id UUID PRIMARY KEY REFERENCES auth.users(id)`
   - `email`, `full_name`, `avatar_url`, `target_lang`, `current_level`, `created_at`, `updated_at`.
2. **`public.user_progress`**:
   - `id UUID PRIMARY KEY`, `user_id UUID REFERENCES public.profiles(id)`
   - `streak_days`, `total_xp`, `total_turns`, `total_lessons`, `fluency_score`, `vocab_score`, `grammar_score`, `last_active_at`.
3. **`public.user_memory`**:
   - `id UUID PRIMARY KEY`, `user_id UUID REFERENCES public.profiles(id)`
   - `category` (`personal`, `preferences`, `corrections`, `interests`, `goals`).
   - `key_phrase`, `memory_value`, `confidence` (FLOAT), `created_at`.
4. **Seguridad**:
   - Políticas RLS (`Row Level Security`) habilitadas para garantizar que cada estudiante solo pueda leer y escribir sus propios registros.

### 3.3. Componentes de UI Integrados
- **`AuthModal.tsx`**: Modal con pestañas de "Iniciar Sesión" y "Crear Cuenta", soporte de validación de contraseñas, feedback visual y píldora de estado de conexión (Supabase Cloud vs Local-First).
- **`UserProfileModal.tsx`**: Dashboard del estudiante con resumen de racha 🔥, nivel CEFR, XP, métricas de fluidez/vocabulario/gramática, y un **Explorador de Memoria del Tutor** para visualizar, agregar y eliminar recuerdos que el tutor IA ha aprendido.
- **`LessonHeader.tsx` & `App.tsx`**: Píldora de usuario en el navbar superior que muestra `👤 Nombre (Nivel)` o el botón `Entrar / Registro`.

---

## 4. Tutor IA Facilitador y Memoria Continua

### 4.1. Calibración por Niveles (A1 - C2)
- **A1**: Frases cortas de 5 a 10 palabras, vocabulario básico, velocidad de habla pausada (0.8x por defecto, ajustable a 0.7x o 1.0x), traducción en texto pequeño en español debajo de cada frase en inglés o chino.
- **A2 - B2**: Escalamiento progresivo de complejidad gramatical y lexical.
- **Alternativas de Respuesta**: Sugerencias tipo botón que el usuario puede pulsar para responder rápidamente o hacer clic en "🔄 Regenerar sugerencias" si desea otras alternativas.

### 4.2. Extracción y Uso de Memoria
- El tutor analiza las respuestas del estudiante en cada turno y extrae entidades clave:
  - Nombres propios, bebidas preferidas (té, café), mascotas, ubicación, aficiones.
- Al iniciar la lección, `getPersonalizedStarter()` recupera el nombre del usuario y sus memorias previas para saludarlo cordialmente y contextualizar la práctica.

---

## 5. Historial de Herramientas y Entorno (Pre-requisitos REA & Sistema)

| Componente | Versión / Detalle | Estado |
|---|---|:---:|
| **Node.js** | `v26.5.1` en `C:\Program Files\nodejs\node.exe` | ✅ |
| **REA (`rea-agents`)** | `v6.7.0` verificado con `rea doctor` y `rea mcp doctor` (207 tools, 6 prompts) | ✅ |
| **Ghidra** | `12.1.4` Portable en `C:\tools\ghidra_12.1.4_PUBLIC` | ✅ |
| **Java JDK** | Eclipse Temurin JDK 21 (`21.0.12.101-hotspot`) | ✅ |
| **FFmpeg** | `v9.0.2` (Gyan.FFmpeg) en PATH del sistema | ✅ |
| **Python** | `Python 3.11.15` | ✅ |

---

## 6. Próximos Pasos (Próxima Sesión)

1. **Revisión de Pruebas de Campo**:
   - Evaluar feedback del usuario tras probar los módulos en móvil y escritorio.
   - Analizar comportamiento de la velocidad del audio y precisión de la traducción en A1/A2.
2. **Calibración Fina**:
   - Ajustar umbrales de confianza en la extracción de memoria automática.
   - Reforzar el catálogo de ejercicios prácticos guiados para los niveles B1 a C1.
3. **Validación de Supabase en Producción**:
   - Confirmar sincronización en vivo de usuarios creados en Render con el panel de Supabase.
