# Memory & System Status: REA (Reverse Engineer Anything) en Windows

Fecha de última actualización: 18 de octubre de 2026

## 1. Resumen Ejecutivo
Se completó con éxito la instalación, configuración e integración de **REA** (`rea-agents@6.7.0`, repositorio oficial `github.com/morluto/rea`) en el sistema operativo Windows.
Debido a que **Hopper Disassembler** no tiene soporte para Windows a nivel de arquitectura y código (`SetupHost.js`), se implementó la alternativa nativa oficial recomendada por REA: **Ghidra 12.1.4 (P0 boundary)** con **Eclipse Temurin JDK 21**.

---

## 2. Checklist Final y Estado de Componentes

| # | Componente | Requisito REA | Estado | Detalle y Ubicación |
|---|---|---|:---:|---|
| 1 | **Node.js** | `>=22.19.0`, `>=24.11.0` o `>=26.0.0` | ✅ | `v26.5.1` en `C:\Program Files\nodejs\node.exe`. No requirió nvm. |
| 2 | **REA (`rea-agents`)** | npm package `rea-agents@6.7.0` | ✅ | Instalado globalmente en `C:\Users\rolan\AppData\Roaming\npm`. Binario `rea` funcional. |
| 3 | **Hopper Disassembler** | Análisis binario nativo | ❌ | **Incompatible con Windows** (solo macOS y Linux). REA lo bloquea explícitamente en el host. |
| 4 | **Proveedor Alternativo: Ghidra** | Ghidra 12.1.x Portable + JDK 21 | ✅ | **Ghidra 12.1.4** instalado en `C:\tools\ghidra_12.1.4_PUBLIC`. Verificado con `rea doctor` (100% healthy: plataforma, arquitectura, headless script, decompiler nativo y Job Objects). |
| 5 | **Java JDK** | JDK 21+ x64 | ✅ | **Eclipse Temurin JDK 21** (`21.0.12.101-hotspot`) instalado en `C:\Program Files\Eclipse Adoptium\jdk-21.0.12.101-hotspot`. |
| 6 | **FFmpeg** | Herramienta multimedia/captura | ✅ | `v9.0.2` (Gyan.FFmpeg) instalado vía `winget`. Binarios en PATH. |
| 7 | **Python** | Python 3.11+ | ✅ | `Python 3.11.15` detectado y verificado en el sistema. |
| 8 | **Servidor MCP de REA** | Transporte stdio para agentes | ✅ | Verificado con `rea mcp doctor` (**healthy: true**, 207 herramientas y 6 prompts operativos). |
| 9 | **REA Skill** | `reverse-engineer-anything` | ✅ | Verificado con `rea doctor` (**state: aligned**, versión 42 con 207 herramientas). |

---

## 3. Configuración del Servidor MCP (`mcp_config.json`)

Archivo: `C:\Users\rolan\.gemini\config\mcp_config.json`
```json
{
  "mcpServers": {
    "rea": {
      "command": "C:\\Program Files\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\rolan\\AppData\\Roaming\\npm\\node_modules\\rea-agents\\scripts\\rea.mjs",
        "mcp"
      ],
      "env": {
        "GHIDRA_INSTALL_DIR": "C:\\tools\\ghidra_12.1.4_PUBLIC",
        "JAVA_HOME": "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.12.101-hotspot",
        "REA_ANALYSIS_PROVIDER": "ghidra"
      }
    }
  }
}
```

---

## 4. Diagnóstico de Salud de REA (`rea mcp doctor`)

```yaml
healthy: true
adapter: production-stdio
server:
  name: rea
  version: 6.7.0
  protocol_version: 2025-11-25
inventory:
  tools: 207 (expected: 207, observed: 207)
  prompts: 6 (expected: 6, observed: 6)
checks:
  initialize: true
  inventory:tools: true
  inventory:prompts: true
  server-identity: true
  request-flow: true (binary_session target-free request)
```

---

## 5. Investigación de Praktika.ai y Nacimiento de MyPolyGloty OS

* **Fecha:** 18-19 de octubre de 2026.
* **Análisis Realizado:**
  * Ingeniería inversa y análisis estático de bundles de producción (`start.praktika.ai`, `flowIds-PLu0agwn.js`, `store-sRB5NsDq.js`, `index-RFzVYR1b.js`).
  * Identificación de arquitectura: Frontend en React 18 / Vite / Zod / TanStack Query; BFF en `core-prod-fast.praktika.ai`; inferencia STT con Whisper sobre Baseten (~300 ms de latencia) y modelos de OpenAI GPT-4/5 para tutores multi-agente con memoria a largo plazo.
  * Modelo de persistencia: triple capa (Memoria React, localStorage con cookie fallback de 365 días y Vault token remoto en servidor).
* **Estrategia Competitiva de MyPolyGloty OS:**
  * Enfoque: Atacar las debilidades estructurales de las grandes plataformas (alto consumo de datos por video streaming, suscripciones costosas por granjas de GPU, cajas negras sin exportación y falta de personalización de contenidos).
  * Diferenciadores Clave: Local-First / Híbrido, cero costo de servidores GPU (renderizado de avatar en el cliente), análisis fonético quirúrgico y corte de errores con FFmpeg, formato de lección abierto y portable (`project.json`), soporte para BYOK y privacidad total.
* **Artefactos y Documentación Generada:**
  1. [`informe-praktika.md`](informe-praktika.md): Reporte técnico completo de ingeniería inversa, tabla de hallazgos y especificación inicial del formato `project.json` y comandos FFmpeg.
  2. [`plan_implementacion_mypolygloty.md`](plan_implementacion_mypolygloty.md): Plan maestro de implementación estructurado en 6 Sprints (Sprint 0 al Sprint 6), con 5 subagentes especializados asignados y matriz de herramientas.
* **Próximo Paso Inmediato (Sesión Siguiente):**
  * Arrancar con el **Sprint 0**: Cimentación del proyecto (Vite + TypeScript), verificación de scripts locales de FFmpeg 9.0.2 y tipado del esquema Zod para `project.json`.

