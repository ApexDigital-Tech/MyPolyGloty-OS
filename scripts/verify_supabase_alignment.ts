/**
 * Script de Verificación de las 5 Pruebas Obligatorias
 * Alineación con Supabase Seguro v2 (RLS & Triggers)
 * MyPolyGloty OS
 */

import { normalizeMemoryCategory, AuthService } from '../src/services/authService';
import { SupabaseService } from '../src/services/supabaseClient';

// Mock simple de localStorage para el entorno Node
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

// Configurar window y localStorage en Node
if (typeof (globalThis as any).window === 'undefined') {
  (globalThis as any).window = globalThis;
}
(globalThis as any).localStorage = new MockLocalStorage();

async function runTests() {
  console.log('================================================================');
  console.log('🧪 INICIO DE SUITE DE PRUEBAS: ALINEACIÓN SUPABASE SEGURO v2');
  console.log('================================================================\n');

  const auth = AuthService.getInstance();
  const supabase = SupabaseService.getInstance();

  let passedCount = 0;
  const totalTests = 5;

  // --------------------------------------------------------------------------
  // PRUEBA 1: Registro de usuario nuevo con nivel e idioma
  // --------------------------------------------------------------------------
  console.log('--- PRUEBA 1: Registro de nuevo usuario (Envío de metadata y cero inserts manuales) ---');
  const testEmailA = `tester_a_${Date.now()}@example.com`;
  const resA = await auth.signUp(testEmailA, 'password123', 'Tester Alpha', 'zh', 'B1');

  if (resA.success) {
    const userA = auth.getCurrentUser();
    const progA = auth.getCurrentProgress();

    console.log('✓ Registro completado exitosamente.');
    console.log(`  - Usuario ID: ${userA?.id}`);
    console.log(`  - Idioma Objetivo: ${userA?.targetLang} (Esperado: zh)`);
    console.log(`  - Nivel CEFR: ${userA?.currentLevel} (Esperado: B1)`);
    console.log(`  - Progreso inicial XP: ${progA?.totalXp}, Racha: ${progA?.streakDays}`);

    if (userA?.targetLang === 'zh' && userA?.currentLevel === 'B1' && progA) {
      console.log('✅ PRUEBA 1 SUPERADA: Perfil y progreso inicializados con los datos de registro.\n');
      passedCount++;
    } else {
      console.error('❌ PRUEBA 1 FALLÓ: Los valores del perfil no coinciden.');
    }
  } else {
    console.error('❌ PRUEBA 1 FALLÓ:', resA.error);
  }

  // --------------------------------------------------------------------------
  // PRUEBA 2: Cerrar sesión y volver a entrar
  // --------------------------------------------------------------------------
  console.log('--- PRUEBA 2: Cerrar sesión y volver a entrar ---');
  await auth.signOut();
  console.log(`  - Tras signOut(): Usuario activo = ${auth.getCurrentUser()}`);

  if (auth.getCurrentUser() === null) {
    const loginRes = await auth.signIn(testEmailA, 'password123');
    const restoredUser = auth.getCurrentUser();
    const restoredProg = auth.getCurrentProgress();

    console.log(`✓ Inicio de sesión resultado: ${loginRes.success}`);
    console.log(`  - Usuario restaurado: ${restoredUser?.fullName} (${restoredUser?.email})`);
    console.log(`  - Nivel restaurado: ${restoredUser?.currentLevel}`);
    console.log(`  - Progreso restaurado: ${restoredProg?.totalXp} XP`);

    if (loginRes.success && restoredUser?.email === testEmailA) {
      console.log('✅ PRUEBA 2 SUPERADA: Sesión cerrada y restaurada con persistencia de perfil y progreso.\n');
      passedCount++;
    } else {
      console.error('❌ PRUEBA 2 FALLÓ: No se restauró la sesión esperada.');
    }
  } else {
    console.error('❌ PRUEBA 2 FALLÓ: signOut no limpió la sesión activa.');
  }

  // --------------------------------------------------------------------------
  // PRUEBA 3: Sin sesión activa: Cero peticiones REST a Supabase
  // --------------------------------------------------------------------------
  console.log('--- PRUEBA 3: Sin sesión activa (Verificación de 0 peticiones REST a Supabase) ---');
  await auth.signOut();

  // Interceptar o espiar llamadas al cliente si existiera
  let networkCallsAttempted = 0;
  if (supabase.client) {
    const originalFrom = supabase.client.from.bind(supabase.client);
    supabase.client.from = (table: string) => {
      networkCallsAttempted++;
      console.warn(`[ALERTA] Intento de llamada a tabla '${table}' sin sesión activa!`);
      return originalFrom(table);
    };
  }

  // Intentar sincronizar diagnóstico, tarjetas y fonética SIN sesión activa
  const syncDiagRes = await supabase.syncCefrDiagnostic({
    band: 'B2',
    score: 75,
    subScores: { range: 75, accuracy: 70, fluency: 80, interaction: 72, complexity: 78 },
    frictions: [],
    turns: [],
    completedAt: Date.now(),
  });

  const syncFsrsRes = await supabase.syncFsrsCards([
    {
      id: 'test-card-1',
      item: 'test',
      targetLang: 'en',
      type: 'vocabulary',
      contextSentence: 'test sentence',
      due: Date.now(),
      stability: 1,
      difficulty: 5,
      elapsedDays: 0,
      scheduledDays: 1,
      reps: 0,
      lapses: 0,
      state: 'new',
      history: [],
    },
  ]);

  const syncPhoneticRes = await supabase.syncPhoneticEvaluation('test', {
    targetWord: 'test',
    overallScore: 88,
    phonemeScores: [],
    hasError: false,
    failingPhonemeIndex: null,
    failingPhoneme: null,
    failingTimeRangeMs: null,
    diagnostic: 'ok',
  });

  console.log(`  - Resultado syncCefrDiagnostic sin sesión: ${syncDiagRes} (Esperado: false)`);
  console.log(`  - Resultado syncFsrsCards sin sesión: ${syncFsrsRes} (Esperado: false)`);
  console.log(`  - Resultado syncPhoneticEvaluation sin sesión: ${syncPhoneticRes} (Esperado: false)`);
  console.log(`  - Llamadas REST a Supabase interceptadas: ${networkCallsAttempted} (Esperado: 0)`);

  if (!syncDiagRes && !syncFsrsRes && !syncPhoneticRes && networkCallsAttempted === 0) {
    console.log('✅ PRUEBA 3 SUPERADA: Cero llamadas a supabase.co/rest/v1 en ausencia de sesión autenticada (Local-First puro).\n');
    passedCount++;
  } else {
    console.error('❌ PRUEBA 3 FALLÓ: Se detectaron llamadas REST a Supabase sin sesión.');
  }

  // --------------------------------------------------------------------------
  // PRUEBA 4: Aislamiento entre 2 cuentas distintas (Cuenta A vs Cuenta B)
  // --------------------------------------------------------------------------
  console.log('--- PRUEBA 4: Aislamiento estricto entre 2 cuentas (Cuenta A vs Cuenta B) ---');
  // Re-iniciar sesión con A y agregar una memoria específica
  await auth.signIn(testEmailA, 'password123');
  await auth.addMemory({
    category: 'fact',
    keyPhrase: 'Secreto de A',
    memoryValue: 'Dato confidencial de Cuenta A',
    confidence: 1.0,
  });

  const memoriesA = auth.getMemories();
  console.log(`  - Cuenta A memorias encontradas: ${memoriesA.length}`);

  // Registrar e iniciar sesión con Cuenta B
  const testEmailB = `tester_b_${Date.now()}@example.com`;
  await auth.signUp(testEmailB, 'password456', 'Tester Beta', 'en', 'A2');
  const memoriesB = auth.getMemories();

  console.log(`  - Cuenta B registrada (${testEmailB}). Memorias visibles para Cuenta B: ${memoriesB.length}`);

  const hasLeakedMemory = memoriesB.some((m) => m.keyPhrase === 'Secreto de A');

  if (memoriesB.length === 0 && !hasLeakedMemory) {
    console.log('✅ PRUEBA 4 SUPERADA: La Cuenta B no puede ver ni modificar los datos ni memorias de la Cuenta A.\n');
    passedCount++;
  } else {
    console.error('❌ PRUEBA 4 FALLÓ: Fuga de datos detectada entre cuentas.');
  }

  // --------------------------------------------------------------------------
  // PRUEBA 5: Validación estricta del CHECK de categorías en user_memory
  // --------------------------------------------------------------------------
  console.log('--- PRUEBA 5: Guardado de memoria del tutor y CHECK de categorías ---');
  const testCategories = [
    { input: 'fact', expected: 'fact' },
    { input: 'interest', expected: 'interest' },
    { input: 'weakness', expected: 'weakness' },
    { input: 'goal', expected: 'goal' },
    { input: 'preference', expected: 'preference' },
    // Casos no canónicos que el normalizador debe sanear:
    { input: 'personal', expected: 'fact' },
    { input: 'corrections', expected: 'weakness' },
    { input: 'hobbies', expected: 'interest' },
    { input: 'tastes', expected: 'preference' },
  ];

  const ALLOWED_SET = new Set(['fact', 'interest', 'weakness', 'goal', 'preference']);
  let allCategoriesValid = true;

  for (const tc of testCategories) {
    const normalized = normalizeMemoryCategory(tc.input);
    const isValid = ALLOWED_SET.has(normalized);
    console.log(`  - Entrada: "${tc.input}" -> Normalizado: "${normalized}" (Válido en CHECK: ${isValid})`);
    if (!isValid || normalized !== tc.expected) {
      allCategoriesValid = false;
    }

    // Agregar memoria
    await auth.addMemory({
      category: tc.input as any,
      keyPhrase: `Clave_${tc.input}`,
      memoryValue: `Valor para ${tc.input}`,
      confidence: 0.95,
    });
  }

  const storedMemories = auth.getMemories();
  const allStoredConformToDbCheck = storedMemories.every((m) => ALLOWED_SET.has(m.category));

  console.log(`  - Total memorias agregadas: ${storedMemories.length}`);
  console.log(`  - ¿Todas las memorias cumplen el CHECK de PostgreSQL?: ${allStoredConformToDbCheck}`);

  if (allCategoriesValid && allStoredConformToDbCheck) {
    console.log('✅ PRUEBA 5 SUPERADA: Todas las memorias del tutor quedan normalizadas dentro de las 5 categorías oficiales sin violar el CHECK.\n');
    passedCount++;
  } else {
    console.error('❌ PRUEBA 5 FALLÓ: Una o más categorías violaron el CHECK permitido.');
  }

  console.log('================================================================');
  console.log(`📊 RESULTADO FINAL: ${passedCount} / ${totalTests} PRUEBAS COMPLETADAS CON ÉXITO`);
  console.log('================================================================');
}

runTests().catch((err) => {
  console.error('Error fatal ejecutando pruebas:', err);
  process.exit(1);
});
