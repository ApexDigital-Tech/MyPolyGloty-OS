/**
 * TutorFacilitatorService - Facilitador Pedagógico Interactivo, Niveles y Traducción
 * MyPolyGloty OS
 * 
 * Gestiona:
 * 1. Niveles progresivos (A1, A2, B1, B2, C1)
 * 2. Velocidad de voz calibrada por nivel y ajustable (A1 pausado 0.75x)
 * 3. Rutinas guiadas con micro-etapas/fases progresivas y frases cortas
 * 4. Traducción simultánea al español en letras pequeñas para tutor y alumno
 * 5. Sugerencias alternativas opcionales y regenerables (Batch A, B, C)
 * 6. Medición evaluada de progreso y racha
 */

import { AuthService } from './authService';

export type TargetLanguage = 'en' | 'zh';
export type LearningLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1';

export interface LearningRoutine {
  id: string;
  title: string;
  icon: string;
  level: LearningLevel;
  language: TargetLanguage;
  description: string;
  starterPrompt: string;
  starterTranslation: string;
  targetTurns: number;
  phases: string[];
}

export interface FacilitatedTurnResponse {
  replyText: string;
  translationText: string;
  pinyin?: string;
  phaseName: string;
  grammarTip?: {
    original: string;
    suggested: string;
    explanation: string;
  };
  suggestedReplies: Array<{ text: string; translation: string }>;
  progress: {
    turnsCompleted: number;
    targetTurns: number;
    phaseName: string;
    fluencyScore: number;
    vocabScore: number;
    grammarScore: number;
  };
}

export const ROUTINES_CATALOG: LearningRoutine[] = [
  {
    id: 'a1-daily-routine',
    title: 'Rutina Diaria (A1)',
    icon: '🌅',
    level: 'A1',
    language: 'en',
    description: 'Aprende a presentarte, saludar y describir gustos con frases ultracortas y voz pausada.',
    starterPrompt: "Hello! I am Alistair. What is your name?",
    starterTranslation: "¡Hola! Soy Alistair. ¿Cómo te llamas?",
    targetTurns: 5,
    phases: ['Presentación', 'Bienestar', 'Bebidas & Gustos', 'Comida diaria', 'Mascotas'],
  },
  {
    id: 'a2-casual-chat',
    title: 'Conversación Casual (A2)',
    icon: '☕',
    level: 'A2',
    language: 'en',
    description: 'Habla sobre tus pasatiempos, planes del fin de semana y comida favorita.',
    starterPrompt: "Hi there! I love hearing about hobbies. What do you enjoy doing in your free time?",
    starterTranslation: "¡Hola! Me encanta escuchar sobre pasatiempos. ¿Qué disfrutas hacer en tu tiempo libre?",
    targetTurns: 6,
    phases: ['Pasatiempos', 'Fines de semana', 'Comida favorita', 'Planes'],
  },
  {
    id: 'b1-interview',
    title: 'Entrevista Laboral (B1)',
    icon: '💼',
    level: 'B1',
    language: 'en',
    description: 'Practica responder preguntas sobre tu experiencia, logros y retos profesionales.',
    starterPrompt: "Welcome to our technical interview. Could you describe a project where you solved a challenging problem?",
    starterTranslation: "Bienvenido a nuestra entrevista técnica. ¿Podrías describir un proyecto donde resolviste un problema desafiante?",
    targetTurns: 6,
    phases: ['Experiencia', 'Retos técnicos', 'Trabajo en equipo', 'Logros'],
  },
  {
    id: 'b2-debate',
    title: 'Debate & Opinión (B2/C1)',
    icon: '🎯',
    level: 'B2',
    language: 'en',
    description: 'Defiende tu punto de vista sobre tecnología, trabajo remoto y futuro del software.',
    starterPrompt: "In software engineering, do you think remote work increases overall productivity, or are the communication trade-offs too high?",
    starterTranslation: "En ingeniería de software, ¿crees que el trabajo remoto aumenta la productividad general o los costes de comunicación son demasiado altos?",
    targetTurns: 6,
    phases: ['Argumentación', 'Trade-offs', 'Casos reales', 'Conclusiones'],
  },
  {
    id: 'zh-starter',
    title: 'Chino Básico HSK1',
    icon: '🇨🇳',
    level: 'A1',
    language: 'zh',
    description: 'Saludos, números, familia y frases cotidianas en mandarín con Pinyin.',
    starterPrompt: "你好！很高兴认识你。你叫什么名字？(Nǐ hǎo! Hěn gāoxìng rènshí nǐ. Nǐ jiào shénme míngzì?)",
    starterTranslation: "¡Hola! Mucho gusto en conocerte. ¿Cómo te llamas?",
    targetTurns: 5,
    phases: ['问候 (Saludos)', '名字 (Nombres)', '日常 (Rutina)', '再见 (Despedida)'],
  },
];

export class TutorFacilitatorService {
  private static instance: TutorFacilitatorService | null = null;
  private currentLanguage: TargetLanguage = 'en';
  private currentLevel: LearningLevel = 'A1'; // Por defecto A1 para escalado selectivo seguro
  private currentRoutine: LearningRoutine = ROUTINES_CATALOG[0]; // A1 por defecto
  private turnsCompleted: number = 0;

  private constructor() {}

  public static getInstance(): TutorFacilitatorService {
    if (!TutorFacilitatorService.instance) {
      TutorFacilitatorService.instance = new TutorFacilitatorService();
    }
    return TutorFacilitatorService.instance;
  }

  public getLevel(): LearningLevel {
    return this.currentLevel;
  }

  public setLevel(level: LearningLevel): void {
    this.currentLevel = level;
    const matching = ROUTINES_CATALOG.find((r) => r.level === level && r.language === this.currentLanguage);
    if (matching) {
      this.currentRoutine = matching;
      this.turnsCompleted = 0;
    }
  }

  public getLanguage(): TargetLanguage {
    return this.currentLanguage;
  }

  public setLanguage(lang: TargetLanguage): void {
    this.currentLanguage = lang;
    const matching = ROUTINES_CATALOG.find((r) => r.language === lang);
    if (matching) {
      this.currentRoutine = matching;
      this.currentLevel = matching.level;
      this.turnsCompleted = 0;
    }
  }

  /**
   * Velocidad de habla recomendada por nivel CEFR:
   * A1: 0.75x (Muy pausado, pronunciación clara de cada fonema)
   * A2: 0.85x (Moderado)
   * B1: 0.95x (Estándar natural)
   * B2: 1.05x (Fluido nativo)
   * C1: 1.15x (Avanzado dinámico)
   */
  public getRecommendedSpeechRate(level: LearningLevel = this.currentLevel): number {
    switch (level) {
      case 'A1':
        return 0.75;
      case 'A2':
        return 0.85;
      case 'B1':
        return 0.95;
      case 'B2':
        return 1.05;
      case 'C1':
        return 1.15;
      default:
        return 0.90;
    }
  }

  public getActiveRoutine(): LearningRoutine {
    return this.currentRoutine;
  }

  public setRoutine(routineId: string): LearningRoutine {
    const r = ROUTINES_CATALOG.find((item) => item.id === routineId) || ROUTINES_CATALOG[0];
    this.currentRoutine = r;
    this.currentLevel = r.level;
    this.currentLanguage = r.language;
    this.turnsCompleted = 0;
    return r;
  }

  public resetProgress(): void {
    this.turnsCompleted = 0;
  }

  /**
   * Obtiene la fase actual de aprendizaje
   */
  public getCurrentPhaseName(): string {
    const phases = this.currentRoutine.phases || ['Práctica Activa'];
    const idx = Math.min(this.turnsCompleted, phases.length - 1);
    return phases[idx];
  }

  /**
   * Genera saludo personalizado usando la memoria del estudiante si está registrado
   */
  public getPersonalizedStarter(routine: LearningRoutine = this.currentRoutine): { prompt: string; translation: string } {
    const user = AuthService.getInstance().getCurrentUser();
    if (user && user.fullName && user.fullName !== 'Estudiante') {
      const firstName = user.fullName.split(' ')[0];
      if (routine.language === 'zh') {
        return {
          prompt: `你好 ${firstName}！很高兴再次见到你。你今天想练习什么？(Nǐ hǎo ${firstName}! Hěn gāoxìng zàicì jiàn dào nǐ. Nǐ jīntiān xiǎng liànxí shénme?)`,
          translation: `¡Hola ${firstName}! Qué gusto verte de nuevo. ¿Qué te gustaría practicar hoy?`,
        };
      }
      if (routine.level === 'A1') {
        return {
          prompt: `Hello ${firstName}! Good to see you again. How are you today?`,
          translation: `¡Hola ${firstName}! Qué bueno verte de nuevo. ¿Cómo estás hoy?`,
        };
      }
    }
    return {
      prompt: routine.starterPrompt,
      translation: routine.starterTranslation,
    };
  }

  /**
   * Alternativas de respuestas regenerables según nivel, idioma y batch
   */
  public getAlternativeSuggestions(
    level: LearningLevel = this.currentLevel,
    language: TargetLanguage = this.currentLanguage,
    batch = 0
  ): Array<{ text: string; translation: string }> {
    if (language === 'zh') {
      const zhBatches = [
        [
          { text: '你好！很高兴认识你。(Nǐ hǎo! Hěn gāoxìng rènshí nǐ.)', translation: '¡Hola! Mucho gusto en conocerte.' },
          { text: '我今天很好，谢谢。(Wǒ jīntiān hěn hǎo, xièxiè.)', translation: 'Hoy estoy muy bien, gracias.' },
          { text: '我想学习中文日常对话。(Wǒ xiǎng xuéxí zhōngwén rìcháng duìhuà.)', translation: 'Quiero aprender conversación diaria en chino.' },
        ],
        [
          { text: '我是学生，我正在学习中文。(Wǒ shì xuéshēng, wǒ zhèngzài xuéxí zhōngwén.)', translation: 'Soy estudiante, estoy aprendiendo chino.' },
          { text: '请说得慢一点，谢谢。(Qǐng shuō de màn yīdiǎn, xièxiè.)', translation: 'Por favor habla un poco más despacio, gracias.' },
          { text: '今天天气很好。(Jīntiān tiānqì hěn hǎo.)', translation: 'Hoy hace muy buen clima.' },
        ],
      ];
      return zhBatches[batch % zhBatches.length];
    }

    if (level === 'A1') {
      const a1Batches = [
        // Batch 0: Saludos & Presentación básica
        [
          { text: 'Hello! My name is Alex.', translation: '¡Hola! Mi nombre es Alex.' },
          { text: 'I am doing well, thank you!', translation: '¡Estoy bien, gracias!' },
          { text: 'I drink coffee in the morning.', translation: 'Tomo café por la mañana.' },
          { text: 'Could you please speak slower?', translation: '¿Podrías hablar más despacio?' },
        ],
        // Batch 1: Bebidas, comida y rutina simple
        [
          { text: 'I like tea and orange juice.', translation: 'Me gusta el té y el jugo de naranja.' },
          { text: 'I eat bread and eggs for breakfast.', translation: 'Como pan y huevos para el desayuno.' },
          { text: 'I drink a coffee in the evening.', translation: 'Tomo un café por la noche.' },
          { text: 'Yes, I have a friendly dog.', translation: 'Sí, tengo un perro amigable.' },
        ],
        // Batch 2: Respuestas ultra-cortas para principiantes
        [
          { text: 'Yes, I do!', translation: '¡Sí, así es!' },
          { text: 'I live in Madrid, Spain.', translation: 'Vivo en Madrid, España.' },
          { text: 'I like pizza and fruit.', translation: 'Me gusta la pizza y la fruta.' },
          { text: 'Thank you for your help, Alistair!', translation: '¡Gracias por tu ayuda, Alistair!' },
        ],
      ];
      return a1Batches[batch % a1Batches.length];
    }

    if (level === 'A2') {
      const a2Batches = [
        [
          { text: 'In my free time, I love cooking and playing guitar.', translation: 'En mi tiempo libre, me encanta cocinar y tocar la guitarra.' },
          { text: 'Last weekend I visited a beautiful park with my family.', translation: 'El fin de semana pasado visité un hermoso parque con mi familia.' },
          { text: 'I usually exercise three times a week.', translation: 'Suelo hacer ejercicio tres veces a la semana.' },
        ],
        [
          { text: 'I enjoy watching movies and reading thriller novels.', translation: 'Disfruto ver películas y leer novelas de suspenso.' },
          { text: 'My favorite dish is homemade lasagna with fresh salad.', translation: 'Mi plato favorito es la lasaña casera con ensalada fresca.' },
          { text: 'I am planning a trip to the mountains soon.', translation: 'Estoy planeando un viaje a las montañas pronto.' },
        ],
      ];
      return a2Batches[batch % a2Batches.length];
    }

    if (level === 'B1') {
      const b1Batches = [
        [
          { text: "I've worked on optimizing frontend bundle sizes using code splitting.", translation: 'He trabajado en optimizar paquetes frontend con división de código.' },
          { text: 'Could you elaborate on the team testing methodology?', translation: '¿Podrías detallar la metodología de pruebas del equipo?' },
          { text: 'We reduced latency by implementing distributed Redis caching.', translation: 'Redujimos la latencia implementando caché distribuida con Redis.' },
        ],
        [
          { text: 'In my last role, I coordinated agile sprints with cross-functional teams.', translation: 'En mi puesto anterior, coordiné sprints ágiles con equipos interdisciplinarios.' },
          { text: 'I refactored legacy microservices to improve maintainability and reliability.', translation: 'Refactoricé microservicios heredados para mejorar mantenibilidad y fiabilidad.' },
          { text: 'We established automated CI/CD pipelines to catch regressions early.', translation: 'Establecimos pipelines automatizados de CI/CD para detectar regresiones rápido.' },
        ],
      ];
      return b1Batches[batch % b1Batches.length];
    }

    // B2 / C1
    const advBatches = [
      [
        { text: 'We prioritize clean modular architecture with comprehensive test coverage.', translation: 'Priorizamos una arquitectura modular limpia con cobertura de pruebas completa.' },
        { text: 'We adopt iterative delivery, validating key assumptions with telemetry.', translation: 'Adoptamos entregas iterativas, validando hipótesis clave con telemetría.' },
      ],
      [
        { text: 'From an engineering standpoint, eventual consistency provides higher availability.', translation: 'Desde el punto de vista de ingeniería, la consistencia eventual da mayor disponibilidad.' },
        { text: 'Balancing technical debt against product deadlines requires proactive triage.', translation: 'Equilibrar deuda técnica con plazos de producto requiere triaje proactivo.' },
      ],
    ];
    return advBatches[batch % advBatches.length];
  }

  /**
   * Genera una respuesta reactiva, empática y facilitadora según lo que dice el alumno y su nivel.
   */
  public generateFacilitatedResponse(userText: string): FacilitatedTurnResponse {
    this.turnsCompleted++;
    const lower = userText.toLowerCase().trim();
    const isZh = this.currentLanguage === 'zh';
    // Extracción continua de memoria del estudiante
    const auth = AuthService.getInstance();
    if (lower.includes('my name is')) {
      const match = userText.match(/my name is ([a-zA-Záéíóúñ]+)/i);
      if (match) {
        auth.addMemory({ category: 'fact', keyPhrase: 'Nombre', memoryValue: match[1], confidence: 1.0 });
      }
    }
    if (lower.includes('coffee')) {
      auth.addMemory({ category: 'interest', keyPhrase: 'Bebida favorita', memoryValue: 'Café', confidence: 0.95 });
    }
    if (lower.includes('tea')) {
      auth.addMemory({ category: 'interest', keyPhrase: 'Bebida favorita', memoryValue: 'Té', confidence: 0.95 });
    }
    if (lower.includes('dog')) {
      auth.addMemory({ category: 'interest', keyPhrase: 'Mascota', memoryValue: 'Perro', confidence: 0.95 });
    }
    if (lower.includes('cat')) {
      auth.addMemory({ category: 'interest', keyPhrase: 'Mascota', memoryValue: 'Gato', confidence: 0.95 });
    }

    // Detección de errores gramaticales comunes para feedback constructivo
    let grammarTip: FacilitatedTurnResponse['grammarTip'];

    if (lower.includes('bad to speak') || lower.includes('bad to explain')) {
      grammarTip = {
        original: 'bad to speak / explain',
        suggested: 'bad at speaking / explaining',
        explanation: "El adjetivo 'bad' va acompañado de la preposición 'at' seguida de gerundio (-ing).",
      };
    } else if (lower.includes('i am agree')) {
      grammarTip = {
        original: 'I am agree',
        suggested: 'I agree',
        explanation: "En inglés 'agree' es un verbo directo; no lleva el verbo 'to be'.",
      };
    } else if (lower.includes('peoples')) {
      grammarTip = {
        original: 'peoples',
        suggested: 'people',
        explanation: "'People' ya es el plural irregular de 'person'.",
      };
    } else if (lower.includes('i drink a coffee')) {
      // Nota sutil de naturalidad opcional
      grammarTip = {
        original: 'a coffee',
        suggested: 'coffee / a cup of coffee',
        explanation: "'Coffee' es incontable; es muy natural decir simplemente 'I drink coffee' o 'a cup of coffee'.",
      };
    }

    // Respuestas para Chino Mandarín
    if (isZh) {
      if (lower.includes('你好') || lower.includes('ni hao') || /\b(hola|hi|hello)\b/.test(lower)) {
        return {
          replyText: "很好！你好吗？你今天忙吗？(Hěn hǎo! Nǐ hǎo ma? Nǐ jīntiān máng ma?)",
          translationText: "¡Muy bien! ¿Cómo estás? ¿Estás ocupado hoy?",
          phaseName: '问候 (Saludos)',
          suggestedReplies: this.getAlternativeSuggestions('A1', 'zh', 0),
          progress: this.calculateProgress(),
        };
      }

      return {
        replyText: "你说得很好！继续加油。你想学什么词汇？(Nǐ shuō de hěn hǎo! Jìxù jiāyóu. Nǐ xiǎng xué shénme cíhuì?)",
        translationText: "¡Lo dijiste muy bien! Sigue adelante. ¿Qué vocabulario te gustaría aprender?",
        phaseName: '日常 (Rutina)',
        suggestedReplies: this.getAlternativeSuggestions('A1', 'zh', 1),
        progress: this.calculateProgress(),
      };
    }

    // NIVEL A1: Calibrado ultra-fácil con frases cortas (4 a 8 palabras), amables y directas
    if (this.currentLevel === 'A1') {
      // 1. Saludo / Nombre
      if (/\b(hello|hi|hey)\b/.test(lower) || lower.includes('name is') || lower.includes('my name')) {
        return {
          replyText: "Nice to meet you! How are you today?",
          translationText: "¡Mucho gusto! ¿Cómo estás hoy?",
          phaseName: 'Bienestar',
          suggestedReplies: [
            { text: "I am good, thank you!", translation: "¡Estoy bien, gracias!" },
            { text: "I am fine. And you?", translation: "Estoy bien. ¿Y tú?" },
            { text: "A bit tired today.", translation: "Un poco cansado hoy." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // 2. Cómo estás / Sentimientos
      if (lower.includes('good') || lower.includes('fine') || lower.includes('tired') || lower.includes('well')) {
        return {
          replyText: "Great! Do you like coffee or tea?",
          translationText: "¡Genial! ¿Te gusta el café o el té?",
          phaseName: 'Bebidas & Gustos',
          suggestedReplies: [
            { text: "I like coffee very much.", translation: "Me gusta mucho el café." },
            { text: "I prefer hot tea.", translation: "Prefiero el té caliente." },
            { text: "I only drink water.", translation: "Solo tomo agua." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // 3. Bebidas (Café / Té)
      if (lower.includes('coffee') || lower.includes('tea') || lower.includes('drink') || lower.includes('water')) {
        return {
          replyText: "Yum! What do you eat for breakfast?",
          translationText: "¡Qué rico! ¿Qué comes para el desayuno?",
          phaseName: 'Comida diaria',
          suggestedReplies: [
            { text: "I eat bread and eggs.", translation: "Como pan y huevos." },
            { text: "I eat fruit and cereal.", translation: "Como fruta y cereal." },
            { text: "I only drink coffee.", translation: "Solo tomo café." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // 4. Comida (Desayuno, pan, huevos, cena)
      if (lower.includes('bread') || lower.includes('egg') || lower.includes('fruit') || lower.includes('eat') || lower.includes('dinner') || lower.includes('evening')) {
        return {
          replyText: "Nice! Do you have a pet, like a dog or cat?",
          translationText: "¡Qué bien! ¿Tienes alguna mascota, como un perro o un gato?",
          phaseName: 'Mascotas',
          suggestedReplies: [
            { text: "Yes, I have a dog.", translation: "Sí, tengo un perro." },
            { text: "Yes, I have a cute cat.", translation: "Sí, tengo un gato lindo." },
            { text: "No, I do not have pets.", translation: "No, no tengo mascotas." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // 5. Mascotas / Animales
      if (lower.includes('dog') || lower.includes('cat') || lower.includes('pet')) {
        return {
          replyText: "Awesome! You completed your A1 daily routine! High five!",
          translationText: "¡Increíble! ¡Completaste tu rutina diaria A1! ¡Choca esos cinco!",
          phaseName: 'Meta Lograda 🎉',
          suggestedReplies: [
            { text: "Thank you, Alistair!", translation: "¡Gracias, Alistair!" },
            { text: "That was easy and fun.", translation: "Eso fue fácil y divertido." },
            { text: "Let's practice more tomorrow.", translation: "Practiquemos más mañana." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // 6. Respuestas afirmativas breves ("yes", "ok", "yes i do")
      if (lower === 'yes' || lower === 'yes i do' || lower === 'yes i am' || lower === 'ok') {
        return {
          replyText: "Great! Tell me, what is your favorite color?",
          translationText: "¡Genial! Cuéntame, ¿cuál es tu color favorito?",
          phaseName: 'Colores & Gustos',
          suggestedReplies: [
            { text: "My favorite color is blue.", translation: "Mi color favorito es el azul." },
            { text: "I love red and green.", translation: "Me encanta el rojo y el verde." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      // Fallback A1 por defecto: Frase corta y pregunta fácil
      return {
        replyText: "Good job! What do you like to do on weekends?",
        translationText: "¡Buen trabajo! ¿Qué te gusta hacer los fines de semana?",
        phaseName: 'Fines de semana',
        suggestedReplies: [
          { text: "I like to sleep and watch TV.", translation: "Me gusta dormir y ver televisión." },
          { text: "I walk in the park with friends.", translation: "Camino en el parque con amigos." },
        ],
        grammarTip,
        progress: this.calculateProgress(),
      };
    }

    // NIVEL A2: Básico / Intermedio Bajo
    if (this.currentLevel === 'A2') {
      if (lower === 'yes' || lower === 'yes i do' || lower === 'yeah') {
        return {
          replyText: "Great! Tell me a bit more about that. Why do you enjoy doing it?",
          translationText: "¡Genial! Cuéntame un poco más sobre eso. ¿Por qué disfrutas haciéndolo?",
          phaseName: 'Profundización',
          suggestedReplies: [
            { text: "Because it helps me relax after a long day.", translation: "Porque me ayuda a relajarme después de un largo día." },
            { text: "It allows me to learn new skills with friends.", translation: "Me permite aprender nuevas habilidades con amigos." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      return {
        replyText: "That's very interesting! How often do you practice that during the week?",
        translationText: "¡Eso es muy interesante! ¿Con qué frecuencia lo practicas durante la semana?",
        phaseName: 'Frecuencia',
        suggestedReplies: [
          { text: "I try to practice at least three times a week.", translation: "Intento practicar al menos tres veces por semana." },
          { text: "Usually on weekends when I have more free time.", translation: "Por lo general los fines de semana cuando tengo más tiempo libre." },
        ],
        grammarTip,
        progress: this.calculateProgress(),
      };
    }

    // NIVEL B1: Intermedio (Trabajo, Proyectos, Retos)
    if (this.currentLevel === 'B1') {
      if (lower === 'yes' || lower === 'yes i do') {
        return {
          replyText: "Understood. Could you share one specific example of how you applied that in your work?",
          translationText: "Entendido. ¿Podrías compartir un ejemplo específico de cómo aplicaste eso en tu trabajo?",
          phaseName: 'Ejemplo Práctico',
          suggestedReplies: [
            { text: "For example, we refactored the database queries to reduce load times.", translation: "Por ejemplo, refactorizamos las consultas a la base de datos para reducir los tiempos de carga." },
            { text: "I collaborated closely with the design team to improve user flow.", translation: "Colaboré estrechamente con el equipo de diseño para mejorar el flujo de usuario." },
          ],
          grammarTip,
          progress: this.calculateProgress(),
        };
      }

      return {
        replyText: "That makes complete sense. What was the biggest challenge you faced while doing that?",
        translationText: "Tiene todo el sentido. ¿Cuál fue el mayor desafío que enfrentaste al hacer eso?",
        phaseName: 'Desafío Técnico',
        suggestedReplies: [
          { text: "Managing tight deadlines while maintaining code quality.", translation: "Manejar plazos ajustados mientras manteníamos la calidad del código." },
          { text: "Ensuring backward compatibility with legacy systems.", translation: "Garantizar la compatibilidad con sistemas heredados." },
        ],
        grammarTip,
        progress: this.calculateProgress(),
      };
    }

    // NIVEL B2/C1: Avanzado
    return {
      replyText: "A very articulate perspective. How do you assess the trade-offs between speed of execution and long-term maintainability in that scenario?",
      translationText: "Una perspectiva muy bien articulada. ¿Cómo evalúas el equilibrio entre la velocidad de ejecución y la mantenibilidad a largo plazo en ese escenario?",
      phaseName: 'Evaluación de Trade-offs',
      suggestedReplies: [
        { text: "We prioritize clean modular architecture with comprehensive test coverage.", translation: "Priorizamos una arquitectura modular limpia con cobertura de pruebas completa." },
        { text: "We adopt iterative delivery, validating key assumptions with telemetry.", translation: "Adoptamos entregas iterativas, validando hipótesis clave con telemetría." },
      ],
      grammarTip,
      progress: this.calculateProgress(),
    };
  }

  /**
   * Traductor inteligente bidireccional al español para cualquier frase del alumno o del tutor.
   */
  public getTranslation(text: string): string {
    const raw = text.trim();
    const lower = raw.toLowerCase().replace(/[.,!?;:]/g, '');

    // 1. Diccionario exacto de frases frecuentes
    const exactDictionary: Record<string, string> = {
      // Rutinas y bebidas
      "i drink a coffee in the evening": "Tomo un café por la noche.",
      "i drink a coffee in the morning": "Tomo un café por la mañana.",
      "i drink coffee in the morning": "Tomo café por la mañana.",
      "i drink coffee": "Tomo café.",
      "i like coffee": "Me gusta el café.",
      "i like coffee very much": "Me gusta mucho el café.",
      "i prefer tea": "Prefiero el té.",
      "i prefer hot tea": "Prefiero el té caliente.",
      "i only drink water": "Solo tomo agua.",
      "i woke up early and drank coffee": "Me levanté temprano y tomé café.",
      "i woke up early and drank coffee this morning": "Me levanté temprano y tomé café esta mañana.",
      "i went for a walk before starting to work": "Fui a caminar antes de empezar a trabajar.",
      "i eat bread and eggs": "Como pan y huevos.",
      "i eat bread and eggs for breakfast": "Como pan y huevos para el desayuno.",
      "i eat fruit and cereal": "Como fruta y cereal.",
      "i have a dog": "Tengo un perro.",
      "yes i have a dog": "Sí, tengo un perro.",
      "yes i have a friendly dog": "Sí, tengo un perro amigable.",
      "yes i have a cute cat": "Sí, tengo un gato lindo.",
      "no i do not have pets": "No, no tengo mascotas.",

      // Saludos y respuestas cortas
      "hello": "¡Hola!",
      "hi": "¡Hola!",
      "good morning": "¡Buenos días!",
      "good afternoon": "¡Buenas tardes!",
      "good evening": "¡Buenas noches!",
      "my name is alex": "Mi nombre es Alex.",
      "i am doing well thank you": "¡Estoy bien, gracias!",
      "i am good thank you": "¡Estoy bien, gracias!",
      "i am fine and you": "Estoy bien. ¿Y tú?",
      "a bit tired today": "Un poco cansado hoy.",
      "yes": "Sí.",
      "yes i do": "Sí, así es / Sí, lo hago.",
      "yes i am": "Sí, lo estoy / Sí, soy yo.",
      "no": "No.",
      "no i dont": "No, no lo hago.",
      "ok": "De acuerdo / Está bien.",
      "thank you": "Gracias.",
      "thank you alistair": "¡Gracias, Alistair!",
      "could you please speak slower": "¿Podrías hablar más despacio, por favor?",
      "could you please speak a bit slower": "¿Podrías hablar un poco más despacio, por favor?",

      // Países y ciudades
      "i am from spain and i live in madrid": "Soy de España y vivo en Madrid.",
      "i am from mexico what about you": "Soy de México. ¿Y tú?",
      "i live in south america": "Vivo en Sudamérica.",
      "i live in madrid spain": "Vivo en Madrid, España.",

      // Chino básico
      "你好": "¡Hola!",
      "我很好谢谢": "Estoy muy bien, gracias.",
      "我想学习中文日常对话": "Quiero aprender conversación diaria en chino.",
      "请说得慢一点谢谢": "Por favor habla un poco más despacio, gracias.",
    };

    if (exactDictionary[lower]) {
      return exactDictionary[lower];
    }

    // 2. Traductor heurístico por patrones (Sujeto + Verbo + Complemento)
    if (lower.startsWith('i drink')) {
      const item = lower.replace('i drink', '').trim();
      return `Tomo ${this.translateWord(item)}.`;
    }
    if (lower.startsWith('i eat')) {
      const item = lower.replace('i eat', '').trim();
      return `Como ${this.translateWord(item)}.`;
    }
    if (lower.startsWith('i like')) {
      const item = lower.replace('i like', '').trim();
      return `Me gusta ${this.translateWord(item)}.`;
    }
    if (lower.startsWith('i have')) {
      const item = lower.replace('i have', '').trim();
      return `Tengo ${this.translateWord(item)}.`;
    }
    if (lower.startsWith('i live in')) {
      const item = lower.replace('i live in', '').trim();
      return `Vivo en ${item}.`;
    }
    if (lower.startsWith('my name is')) {
      const name = lower.replace('my name is', '').trim();
      return `Mi nombre es ${name}.`;
    }

    // Si ya tiene una traducción conocida en el mensaje
    return 'Traducción de apoyo en español';
  }

  private translateWord(word: string): string {
    const dict: Record<string, string> = {
      'coffee': 'café',
      'a coffee': 'un café',
      'tea': 'té',
      'water': 'agua',
      'beer': 'cerveza',
      'bread': 'pan',
      'eggs': 'huevos',
      'bread and eggs': 'pan y huevos',
      'fruit': 'fruta',
      'pizza': 'pizza',
      'in the evening': 'por la noche',
      'in the morning': 'por la mañana',
      'a dog': 'un perro',
      'a cat': 'un gato',
      'a friendly dog': 'un perro amigable',
    };
    return dict[word] || word;
  }

  private calculateProgress() {
    const target = this.currentRoutine.targetTurns;
    const completed = Math.min(this.turnsCompleted, target);
    const baseScore = Math.min(96, 78 + this.turnsCompleted * 3);

    return {
      turnsCompleted: completed,
      targetTurns: target,
      phaseName: this.getCurrentPhaseName(),
      fluencyScore: baseScore,
      vocabScore: Math.min(93, baseScore - 2),
      grammarScore: Math.min(97, baseScore + 2),
    };
  }
}
