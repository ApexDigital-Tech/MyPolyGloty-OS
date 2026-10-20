# INFORME DE ENTREGA — Alinear la app con la nueva base de datos segura (Supabase v2)

**Proyecto:** MyPolyGloty OS  
**Fecha:** 20 de octubre de 2026  
**Prioridad:** CRÍTICA  
**Rama de trabajo:** `fix/supabase-secure-alignment` (creada y subida a origin; sin merge a `main`)  
**Regla cumplida:** CERO merge ni push a `main`. Render no ha desplegado cambios a producción/testers.  
**Pull Request en GitHub:** [https://github.com/ApexDigital-Tech/MyPolyGloty-OS/pull/new/fix/supabase-secure-alignment](https://github.com/ApexDigital-Tech/MyPolyGloty-OS/pull/new/fix/supabase-secure-alignment)  
**Estado:** Pausa y Espera de Revisión por el Auditor Senior.

---

## 1. Archivos Modificados y Resumen del Diff

| Archivo | Tipo de Cambio | Resumen |
|---|---|---|
| `src/services/authService.ts` | Modificado | Envío de `options.data` en `signUp`, eliminación de inserts manuales a perfiles/progreso, manejo de caso sin sesión (confirmación email), normalización de 5 categorías de memoria, y reglas de sincronización. |
| `src/services/supabaseClient.ts` | Modificado | Guarda activa de sesión en métodos `sync*`, garantizando 0 peticiones REST a Supabase sin sesión activa. Fallback seguro a Local-First. Uso estricto de clave `anon`. |
| `src/services/fsrsScheduler.ts` | Modificado | Generación de IDs con `crypto.randomUUID()` evitando colisiones. |
| `src/components/AuthScreen.tsx` | Modificado | Envío de idioma y nivel seleccionado a `signUp`, soporte de mensaje para confirmación de email. |
| `src/components/UserProfileModal.tsx` | Modificado | Inclusión de categoría `preference` en selector visual. |
| `supabase/migrations/20261020_0001_secure_schema_v2.sql` | Creado | Migración v2 con cabecera `"YA APLICADO en producción el 2026-10-20. No re-ejecutar."`, RLS authenticated y trigger. |
| `supabase/schema.sql` | Modificado | Alineación completa con el esquema v2 seguro. |
| `memory.md` | Modificado | Corrección de fecha a 20 de octubre de 2026, documentación de estado previo Local-First, esquema v2 y reglas de sincronización. |
| `scripts/verify_supabase_alignment.ts` | Creado | Runner automatizado para validar las 5 pruebas obligatorias. |

```diff
 memory.md                                            | 135 ++++++++------
 src/components/AuthScreen.tsx                        |  11 +-
 src/components/UserProfileModal.tsx                  |   3 +-
 src/services/authService.ts                          | 358 ++++++++++++++++++++++++++----------
 src/services/fsrsScheduler.ts                        |   4 +-
 src/services/supabaseClient.ts                       |  89 +++++++--
 supabase/schema.sql                                  | 191 ++++++++++++++++---
 supabase/migrations/20261020_0001_secure_schema_v2.sql | 148 +++++++++++++++
 scripts/verify_supabase_alignment.ts                 | 259 ++++++++++++++++++++++++++
 9 files changed, 1118 insertions(+), 209 deletions(-)
```

---

## 2. Calidad de Código (Quality Gates)

- **`npm run build`**:
  - Comando: `tsc -b && vite build`
  - Estado: **ÉXITO** (Exit code: 0)
  - Salida: 2098 módulos transformados en 6.83s, 0 errores.
- **`npm run lint`**:
  - Comando: `oxlint`
  - Estado: **ÉXITO** (Exit code: 0)
  - Salida: 0 errores (31 warnings de refs/useCallback preexistentes en App.tsx).

---

## 3. Resultados de las 5 Pruebas Obligatorias

Ejecutadas con `scripts/verify_supabase_alignment.ts`:

### Prueba 1: Registro de un usuario nuevo con nivel e idioma elegidos
- **Resultado:** **SUPERADA**
- **Evidencia:** `signUp('tester_a@example.com', '...', 'Tester Alpha', 'zh', 'B1')` transmite `options.data = { full_name: 'Tester Alpha', target_lang: 'zh', current_level: 'B1' }`. No se realizan llamadas `INSERT` manuales a `profiles` ni `user_progress`. El usuario se inicializa con idioma `zh` y nivel `B1`.

### Prueba 2: Cerrar sesión y volver a entrar
- **Resultado:** **SUPERADA**
- **Evidencia:** `signOut()` limpia el estado activo y el almacenamiento local. Al ejecutar `signIn()`, se restaura el perfil y el progreso persistido (`50 XP`, nivel `B1`).

### Prueba 3: Sin sesión activa: Cero peticiones REST a Supabase
- **Resultado:** **SUPERADA**
- **Evidencia:** Con sesión nula, las llamadas a `syncCefrDiagnostic`, `syncFsrsCards` y `syncPhoneticEvaluation` abortan antes de invocar el cliente de Supabase. Cero llamadas HTTP a `supabase.co/rest/v1`. Los datos se conservan en `localStorage` en modo Local-First.

### Prueba 4: Aislamiento estricto entre 2 cuentas distintas
- **Resultado:** **SUPERADA**
- **Evidencia:** Usuario A almacena memorias en su sesión. Al cerrar sesión y registrar al Usuario B, la cuenta B observa 0 memorias y ningún dato del Usuario A. Cumplimiento de RLS `auth.uid() = user_id`.

### Prueba 5: El tutor guarda una memoria sin violar el CHECK de categoría
- **Resultado:** **SUPERADA**
- **Evidencia:** `normalizeMemoryCategory()` procesa entradas canónicas y coloquiales (`personal` -> `fact`, `corrections` -> `weakness`, `hobbies` -> `interest`, `tastes` -> `preference`). El 100% de las 9 memorias agregadas cumple la restricción CHECK de PostgreSQL:
  `CHECK (category IN ('fact', 'interest', 'weakness', 'goal', 'preference'))`.

---

## 4. Investigación Técnica (Puntos a–f)

### a. `byokStorage.ts`: Almacenamiento de API keys y llamadas a proveedores
- **Ubicación:** Se almacenan exclusivamente en el `localStorage` del cliente bajo la clave `'mypolygloty_byok_configs_v2'` (`byokStorage.ts:8`, `byokStorage.ts:97`).
- **Tráfico:** Las llamadas a STT, LLM y TTS **salen 100% directo desde el navegador** del usuario a los endpoints de Groq (`api.groq.com`), OpenAI (`api.openai.com`) y Ollama local (`localhost:11434`), adjuntando la clave en el header `Authorization: Bearer ${apiKey}`.

### b. `PhoneticEngine.ts`: Algoritmos y naturaleza del análisis
- **Audio en vivo de usuario:** Analiza PCM real con **algoritmos heurísticos propios**, sin librerías externas de Forced Alignment:
  - Formante F1 estimado mediante energía RMS de muestras PCM (`PhoneticEngine.ts:125-132`).
  - Formante F2 estimado mediante Zero-Crossing Rate (`PhoneticEngine.ts:133-139`).
  - Frecuencia fundamental $F_0$ (tonos mandarín) mediante autocorrelación en `PitchTracker.ts:35-85`.
- **Casos de Benchmark:** En `evaluateBenchmarkCase` (`PhoneticEngine.ts:195-243`), es **simulado**: lee directamente los metadatos ground truth de `BenchmarkCase` y genera un resultado estático sin decodificar el `.wav`.

### c. `generate_benchmark_audio.py` y cálculo de F1 en `runBenchmark.ts`
- **Naturaleza de los 20 audios:** Son **100% sintéticos**, generados matemáticamente mediante síntesis sinusoidal con armónicos y decaimiento en Python (`scripts/generate_benchmark_audio.py:25-60`). No son grabaciones de locutores humanos.
- **Cálculo de F1:** En `runBenchmark.ts:55-85`, compara si el fonema erróneo detectado coincide con el fonema de referencia ground truth; calcula $TP$, $FP$, $FN$ y aplica:
  $$F_1 = 2 \cdot \frac{\text{Precisión} \cdot \text{Recall}}{\text{Precisión} + \text{Recall}}$$

### d. `sessionVideoExporter.ts`: Exportación de video en producción
- **Funcionamiento:** **Funciona 100% en el navegador del cliente en producción.**
- **Implementación:** Renderiza las diapositivas en un elemento `<canvas>` HTML5 en memoria a 30 FPS (`canvas.captureStream(30)`) y graba con `MediaRecorder` (`sessionVideoExporter.ts:80-99`). No depende de FFmpeg en el servidor ni de MP4s pregrabados.

### e. Variables de entorno en Render y consecuencias de su ausencia
- **Variables configuradas (`render.yaml`):** `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
- **Comportamiento si faltan:** El build compila sin errores. En tiempo de ejecución, la app detecta la ausencia de la clave `anon`, activa el modo **Local-First**, almacena todo en `localStorage` y continúa operativa sin romper la experiencia del usuario.

### f. Cabeceras de seguridad en `render.yaml`
- **Configuradas:** Únicamente `Access-Control-Allow-Origin: "*"` y `Cross-Origin-Resource-Policy: cross-origin` (`render.yaml:12-17`).
- **Faltantes:** No cuenta con Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), X-Frame-Options ni Permissions-Policy.

---

## 5. Propuesta Técnica sobre Claves Primarias `id TEXT` (Punto 2.C)

Para evitar duplicidad y mantener llaves universales generadas directamente por PostgreSQL, se propone el siguiente SQL (pendiente de aprobación antes de ejecutar):

```sql
-- PROPUESTA DE MIGRACIÓN FUTURA (NO EJECUTADA):
ALTER TABLE public.fsrs_cards 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.cefr_diagnostics 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;

ALTER TABLE public.conversation_sessions 
  ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
```

---

## 6. Riesgos Identificados

1. **Confirmación de Correo Obligatoria:** Si en el panel de Supabase Auth está habilitada la confirmación de email, el usuario nuevo no tendrá sesión inmediata hasta confirmar. La app lo notifica correctamente con `"Revisa tu correo"`, pero debe considerarse durante las pruebas de campo.
2. **Encabezado CSP en Render:** Es recomendable agregar una directiva CSP en `render.yaml` que restrinja los orígenes de conexión `connect-src` a los servicios explícitos utilizados (Supabase, OpenAI, Groq).
