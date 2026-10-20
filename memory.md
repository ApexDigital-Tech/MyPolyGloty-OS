# Memory & System Status: MyPolyGloty OS

**Fecha de última actualización:** 20 de octubre de 2026 (Alineación con Supabase Seguro v2 & Pruebas de Campo)

---

## 1. Resumen Ejecutivo y Estado Actual
**MyPolyGloty OS** ha completado la **Alineación con Supabase Seguro v2** y se encuentra en **Pausa de Auditoría**.

> [!NOTE]
> **Estado de la Sesión Actual (20-oct-2026):**
> - Se completaron todas las tareas de la Instrucción 1 en la rama `fix/supabase-secure-alignment`.
> - **CERO merge ni push a `main`** para proteger el auto-deploy de Render a testers.
> - Se generó y guardó el informe de entrega formal en [`INFORME_ALINEACION_SUPABASE_V2.md`](file:///c:/Users/rolan/Downloads/POlyGloty%20OS/INFORME_ALINEACION_SUPABASE_V2.md).
> - Se encuentra abierta la solicitud de Pull Request para revisión del auditor senior.
> - **Pausa activa:** Esperando revisión y visto bueno del auditor senior para proceder con la fusión y el despliegue.

> [!IMPORTANT]
> **Historial de Base de Datos**: Las tablas en la nube de Supabase se crearon y configuraron formalmente el **20 de octubre de 2026**. Con anterioridad a esta fecha, la aplicación operaba exclusivamente en **modo Local-First** (`localStorage`).

El sistema cuenta con:
1. Una interfaz conversacional inmersiva inspirada en Praktika (modo oscuro/claro, 100% responsiva para móvil y escritorio).
2. Modo conversacional interactivo completo: chat de texto + micrófono STT en tiempo real, velocidad de voz calibrable (0.7x a 1.0x), subtítulos con micro-traducciones en español y sugerencias de respuesta opcionales y regenerables.
3. Tutor IA pedagógico facilitador con calibración por niveles CEFR (A1 a C2).
4. **Sistema de Autenticación y Pantallas Independientes** (`AuthScreen.tsx`): Vistas dedicadas de alta fidelidad para Iniciar Sesión y Crear Cuenta, con selección de idioma y nivel CEFR inicial.
5. **Métricas de Avance y Progreso** (Racha de días 🔥, XP acumulado, turnos completados, desglose de fluidez, vocabulario y gramática).
6. **Memoria Continua del Tutor** (`user_memory`): Detección automática de hechos e intereses del alumno y saludos dinámicos personalizados con categorías validadas.
7. Despliegue continuo en la nube (GitHub + Render + Supabase).
8. **Suite de pruebas de alineación 5/5 superada** (`scripts/verify_supabase_alignment.ts`).

---

## 2. Infraestructura y Despliegue

| Componente | Servicio / Proveedor | Enlace / Identificador | Estado |
|---|---|---|:---:|
| **Repositorio Código** | GitHub | [ApexDigital-Tech/MyPolyGloty-OS](https://github.com/ApexDigital-Tech/MyPolyGloty-OS.git) | ✅ Activo (`main` / `fix/supabase-secure-alignment`) |
| **Producción Web** | Render Cloud Hosting | `https://mypolygloty-os.onrender.com/` | ✅ Desplegado (Auto-Deploy en `main`) |
| **Base de Datos & Auth** | Supabase Cloud | `https://rgnkwfgeivgfvqwcyiow.supabase.co` | ✅ Esquema v2 Seguro & RLS Activo (20-oct) |
| **Desarrollo Local** | Vite Dev Server | `http://localhost:5173/` | ✅ Operativo |

---

## 3. Arquitectura de Autenticación, RLS y Sincronización Segura

### 3.1. Modelo de Seguridad RLS v2 (Estricto Authenticated)
A partir del 20 de octubre de 2026, las políticas públicas han sido eliminadas por completo:
- **Rol `anon`**: Cero permisos de lectura o escritura en todas las tablas de Supabase.
- **Rol `authenticated`**: Acceso restringido exclusivamente a las filas donde `auth.uid() = user_id` (o `id = auth.uid()` en `profiles`).
- **Sin Sesión Activa**: La app no ejecuta ninguna llamada REST a `supabase.co/rest/v1`. Opera en modo Local-First y muestra el indicador correspondiente.
- **Creación de Perfiles**: `profiles` **no tiene política INSERT para el cliente**. El perfil y el registro de progreso inicial son creados automáticamente por el trigger `on_auth_user_created` en la base de datos a partir de `raw_user_meta_data` (`full_name`, `target_lang`, `current_level`).

### 3.2. Regla de Sincronización de Datos (Local <-> Cloud)
Al iniciar sesión exitosamente con Supabase Auth, se aplica la siguiente política:
1. **Perfil (`profiles`) — Cloud-Master**:
   La nube es la fuente canónica de verdad. Se descarga el perfil remoto y se actualiza el estado local en `localStorage`.
2. **Progreso (`user_progress`) — Max-Accumulative**:
   Se fusiona el progreso offline con el remoto tomando el valor máximo:
   `streak_days = max(local, remote)`
   `total_xp = max(local, remote)`
   `total_turns = max(local, remote)`
   `total_lessons = max(local, remote)`
   Si el estudiante acumuló avance sin conexión que supera a la nube, se ejecuta un `UPDATE` en Supabase para proteger su esfuerzo.
3. **Memoria Continua (`user_memory`) — Aditiva Deduplicada**:
   Las memorias locales que no existan en la nube (comparando por `key_phrase`) se insertan en Supabase con su `category` normalizada. Todas las memorias remotas se guardan en el caché local.

### 3.3. Esquema Canónico de Base de Datos (`supabase/schema.sql`)
1. **`public.profiles`**:
   - `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
   - `email`, `full_name`, `avatar_url`, `target_lang`, `current_level` (CHECK `'A1'..'C2'`), `created_at`, `updated_at`.
   - RLS: SELECT y UPDATE para `auth.uid() = id`. Sin INSERT (controlado por trigger).
2. **`public.user_progress`**:
   - `user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE`
   - `streak_days`, `total_xp`, `total_turns`, `total_lessons`, `fluency_score`, `vocab_score`, `grammar_score`, `last_active_at`, `created_at`.
   - RLS: SELECT, INSERT, UPDATE para `auth.uid() = user_id`.
3. **`public.user_memory`**:
   - `id BIGSERIAL PRIMARY KEY`, `user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE`.
   - `category TEXT CHECK (category IN ('fact', 'interest', 'weakness', 'goal', 'preference'))`.
   - `key_phrase`, `memory_value`, `confidence NUMERIC`, `created_at`, `updated_at`.
   - RLS: SELECT, INSERT, UPDATE, DELETE para `auth.uid() = user_id`.
4. **`public.cefr_diagnostics`**:
   - `id TEXT PRIMARY KEY` (generado con `crypto.randomUUID()`), `user_id UUID REFERENCES public.profiles(id)`.
   - `band`, `score`, `vocabulary_score`, `grammar_score`, `fluency_score`, `temporal_wpm`, `psychological_frictions`, `turn_logs`.
   - RLS: SELECT, INSERT, UPDATE para `auth.uid() = user_id`.
5. **`public.fsrs_cards`**:
   - `id TEXT PRIMARY KEY` (generado con `crypto.randomUUID()`), `user_id UUID REFERENCES public.profiles(id)`.
   - `item`, `target_lang`, `card_type`, `ipa`, `context_sentence`, `due`, `stability`, `difficulty`, `reps`, `lapses`, `state`, `history`, `updated_at`.
   - RLS: SELECT, INSERT, UPDATE, DELETE para `auth.uid() = user_id`.
6. **`public.phonetic_evaluations`**:
   - `id BIGSERIAL PRIMARY KEY`, `user_id UUID REFERENCES public.profiles(id)`.
   - `target_word`, `canonical_ipa`, `detected_ipa`, `overall_score`, `formants`, `phonemes`, `created_at`.
   - RLS: SELECT, INSERT para `auth.uid() = user_id`.
7. **`public.conversation_sessions`**:
   - `id TEXT PRIMARY KEY` (generado con `crypto.randomUUID()`), `user_id REFERENCES public.profiles(id)`.
   - `scenario_title`, `cefr_level`, `messages`, `total_latency_p50`, `created_at`.
   - RLS: SELECT, INSERT, UPDATE para `auth.uid() = user_id`.

---

## 4. Tutor IA Facilitador y Memoria Continua

### 4.1. Calibración por Niveles (A1 - C2)
- **A1**: Frases cortas de 5 a 10 palabras, vocabulario básico, velocidad de habla pausada (0.8x por defecto, ajustable a 0.7x o 1.0x), traducción en texto pequeño en español debajo de cada frase en inglés o chino.
- **A2 - B2**: Escalamiento progresivo de complejidad gramatical y lexical.
- **Alternativas de Respuesta**: Sugerencias tipo botón que el usuario puede pulsar para responder rápidamente o hacer clic en "🔄 Regenerar sugerencias" si desea otras alternativas.

### 4.2. Extracción y Normalización de Memoria
- El tutor analiza las respuestas del estudiante y clasifica las entidades en las 5 categorías oficiales:
  - `'fact'`: Nombre propio, procedencia, ocupación.
  - `'interest'`: Aficiones, deportes, mascotas.
  - `'preference'`: Bebidas preferidas (café, té), estilos de aprendizaje.
  - `'weakness'`: Fonemas conflictivos o errores gramaticales recurrentes.
  - `'goal'`: Bandas CEFR objetivo, preparación de entrevistas.
- Al iniciar la lección, `getPersonalizedStarter()` recupera el nombre del usuario y sus memorias previas para saludarlo cordialmente y contextualizar la práctica.

---

## 5. Historial de Herramientas y Entorno

| Componente | Versión / Detalle | Estado |
|---|---|:---:|
| **Node.js** | `v26.5.1` en `C:\Program Files\nodejs\node.exe` | ✅ |
| **REA (`rea-agents`)** | `v6.7.0` verificado con `rea doctor` y `rea mcp doctor` (207 tools, 6 prompts) | ✅ |
| **Ghidra** | `12.1.4` Portable en `C:\tools\ghidra_12.1.4_PUBLIC` | ✅ |
| **Java JDK** | Eclipse Temurin JDK 21 (`21.0.12.101-hotspot`) | ✅ |
| **FFmpeg** | `v9.0.2` (Gyan.FFmpeg) en PATH del sistema | ✅ |
| **Python** | `Python 3.11.15` | ✅ |

---

## 6. Registro de Cambios Recientes (20 de octubre de 2026)
- **Alineación con Supabase Seguro v2**:
  - Creación de migración `supabase/migrations/20261020_0001_secure_schema_v2.sql` ("YA APLICADO en producción el 2026-10-20").
  - `supabase/schema.sql` actualizado para reflejar RLS estricto (`authenticated` only) y trigger `on_auth_user_created`.
  - `signUp` configurado para enviar `options.data = { full_name, target_lang, current_level }` eliminando cualquier inserción manual a `profiles` y `user_progress`.
  - Soporte para confirmación de email: si no hay sesión inmediata, se emite aviso claro sin llamadas a la base de datos.
  - Garantía de cero peticiones a `supabase.co/rest/v1` en modo sin sesión (Local-First).
  - Normalización estricta de categorías de memoria a: `fact`, `interest`, `weakness`, `goal`, `preference`.
  - Uso de `crypto.randomUUID()` para generación de IDs de tarjetas FSRS y diagnósticos CEFR.

---

## 7. Pendientes para la Próxima Sesión
1. **Revisión del Auditor Senior**:
   - Analizar el feedback y observaciones sobre [`INFORME_ALINEACION_SUPABASE_V2.md`](file:///c:/Users/rolan/Downloads/POlyGloty%20OS/INFORME_ALINEACION_SUPABASE_V2.md).
   - Aplicar posibles ajustes solicitados por la auditoría si fuesen requeridos.
2. **Merge del Pull Request hacia `main`**:
   - Una vez aprobado el PR por el auditor/director, fusionar `fix/supabase-secure-alignment` a `main`.
   - Verificar el despliegue automático en Render Cloud Hosting.
3. **Pruebas de Campo con Testers**:
   - Verificación en vivo de flujos de registro, login, persistencia y memoria continua en la URL de producción (`https://mypolygloty-os.onrender.com/`).

