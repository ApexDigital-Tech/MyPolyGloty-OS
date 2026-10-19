import { LessonPackSchema, type LessonPack } from '../types/lesson';

const rawLessonData = {
  metadata: {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    version: '2.0.0',
    title: 'Senior Frontend Engineer Job Interview',
    description: 'Practica responder preguntas sobre arquitectura de software, manejo de estado y resolución de conflictos técnicos bajo presión.',
    targetLanguage: 'en-GB',
    cefrLevel: 'B1',
    durationMinutes: 12,
    author: 'MyPolyGloty Pedagogical Team',
    tags: ['career', 'technology', 'interview', 'b1-b2']
  },
  scenario: {
    situation: 'Entrevista virtual con el CTO de una fintech londinense.',
    tutorPersona: 'Alistair Vance, CTO técnico británico, empático pero minucioso con la claridad fonética y precisión conceptual.',
    userRole: 'Candidato a Ingeniero Frontend Senior',
    goal: 'Explicar cómo resolviste un cuello de botella de rendimiento y demostrar dominio del vocabulario técnico.'
  },
  rubric: {
    grammarFocus: ['Present Perfect vs. Past Simple', 'Second Conditional for hypothetical scenarios', 'Technical Phrasal Verbs'],
    vocabularyList: ['Bottleneck', 'State Management', 'Throughput', 'Trade-offs', 'Scalability'],
    phoneticTargets: [
      {
        ipa: '/v/',
        wordExample: 'very, develop',
        description: 'Fricativa labiodental sonora (dientes superiores sobre labio inferior, vibración vocal, sin confundir con /b/)'
      },
      {
        ipa: '/θ/',
        wordExample: 'throughput, think',
        description: 'Fricativa dental sorda (lengua entre los dientes, aire continuo sin oclusión /t/)'
      },
      {
        ipa: '/dʒ/',
        wordExample: 'job, agile',
        description: 'Africada postalveolar sonora (vibración en la liberación africada)'
      },
      {
        ipa: '/ər/',
        wordExample: 'performance, architecture',
        description: 'Vocal central no acentuada (schwa con coloración rótica suave)'
      }
    ],
    minPassingScore: 75
  },
  starterDialogue: [
    {
      role: 'tutor',
      text: "Hello! Thanks for taking the time today. Could you walk me through a challenging performance issue you've recently tackled?",
      hints: ['Usa el Present Perfect para introducir la experiencia y Past Simple para detalles concretos.', 'Cuidado con la pronunciación de /v/ en "very" y "develop".']
    }
  ]
};

// Validación estricta en tiempo de ejecución con Zod
export const defaultLesson: LessonPack = LessonPackSchema.parse(rawLessonData);
