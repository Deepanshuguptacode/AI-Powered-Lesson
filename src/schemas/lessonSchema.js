'use strict';

/**
 * Lesson JSON Schema & Validator
 *
 * Defines the complete structure of a generated 45-minute lesson.
 * Includes a duration validator that ensures total section times sum to exactly 45 minutes.
 */

// ── Section duration constants (in minutes) ───────────────────────────────────

const TOTAL_LESSON_DURATION = 45;

// ── Schema definition (plain object — used for LLM prompting and validation) ──

/**
 * Expected lesson JSON structure returned by the LLM lesson generator.
 *
 * {
 *   lessonId: string,
 *   title: string,
 *   learningObjective: string,
 *   totalDurationMinutes: 45,
 *   sections: {
 *     introduction:          { durationMinutes, content }
 *     coreConcepts:          { durationMinutes, concepts: [{ title, explanation, evidence }] }
 *     examples:              { durationMinutes, items: [{ title, description, sourceRef }] }
 *     practicalDemonstration:{ durationMinutes, steps: [{ stepNumber, instruction, tip }] }
 *     handsOnActivity:       { durationMinutes, instructions, materials, expectedOutcome }
 *     knowledgeCheck:        { durationMinutes, questions: [{ question, options, answer, explanation }] }
 *     summary:               { durationMinutes, keyTakeaways: string[] }
 *   },
 *   youtubeVideos: [{ title, url, channelName, durationMinutes, relevance }],
 *   references:    [{ title, url, sourceType, description }],
 *   researchSessionId: string,
 *   generatedAt: ISO timestamp
 * }
 */

const LESSON_SCHEMA_TEMPLATE = {
  lessonId: 'string — MongoDB _id of the parent Lesson document',
  title: 'string — lesson title',
  learningObjective: 'string — the learning objective this lesson achieves',
  totalDurationMinutes: 45,
  sections: {
    introduction: {
      durationMinutes: 'number (5)',
      overview: 'string — brief overview of the topic',
      whyItMatters: 'string — real-world relevance',
      whatYouWillLearn: 'string[] — bullet list of outcomes',
    },
    coreConcepts: {
      durationMinutes: 'number (12)',
      concepts: [
        {
          title: 'string',
          explanation: 'string — clear, evidence-based explanation',
          evidenceQuote: 'string — quoted passage from research sources',
          sourceRef: 'string — URL or title of the source',
        },
      ],
    },
    examples: {
      durationMinutes: 'number (8)',
      items: [
        {
          title: 'string',
          description: 'string — detailed example',
          realWorldContext: 'string',
          sourceRef: 'string',
        },
      ],
    },
    practicalDemonstration: {
      durationMinutes: 'number (8)',
      description: 'string — what is being demonstrated',
      steps: [
        {
          stepNumber: 'number',
          instruction: 'string',
          tip: 'string — optional instructor tip',
        },
      ],
    },
    handsOnActivity: {
      durationMinutes: 'number (7)',
      title: 'string',
      instructions: 'string — step-by-step activity guide',
      materials: 'string[] — required materials or tools',
      expectedOutcome: 'string',
    },
    knowledgeCheck: {
      durationMinutes: 'number (3)',
      questions: [
        {
          questionNumber: 'number',
          question: 'string',
          type: 'multiple_choice | true_false | short_answer',
          options: 'string[] — choices (for multiple_choice)',
          correctAnswer: 'string',
          explanation: 'string — why this is correct',
        },
      ],
    },
    summary: {
      durationMinutes: 'number (2)',
      keyTakeaways: 'string[] — 3-5 key points',
      nextSteps: 'string — suggested follow-up learning',
    },
  },
  youtubeVideos: [
    {
      title: 'string',
      url: 'string',
      channelName: 'string',
      durationDescription: 'string — e.g. "12 min"',
      relevance: 'string — why this video supports the lesson',
    },
  ],
  references: [
    {
      title: 'string',
      url: 'string',
      sourceType: 'web | book | youtube',
      description: 'string',
    },
  ],
  researchSessionId: 'string — MongoDB ResearchSession _id',
  generatedAt: 'ISO 8601 timestamp',
};

// ── Section names and expected durations ──────────────────────────────────────

const SECTION_DURATIONS = {
  introduction: 5,
  coreConcepts: 12,
  examples: 8,
  practicalDemonstration: 8,
  handsOnActivity: 7,
  knowledgeCheck: 3,
  summary: 2,
};

// Total: 5+12+8+8+7+3+2 = 45 ✓

// ── Validation functions ──────────────────────────────────────────────────────

/**
 * Validate that totalDurationMinutes equals exactly 45.
 * @param {object} lesson
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateTotalDuration(lesson) {
  const errors = [];

  if (!lesson || typeof lesson !== 'object') {
    return { valid: false, errors: ['lesson must be a non-null object'] };
  }

  if (lesson.totalDurationMinutes !== TOTAL_LESSON_DURATION) {
    errors.push(
      `totalDurationMinutes must be exactly ${TOTAL_LESSON_DURATION}, got ${lesson.totalDurationMinutes}`
    );
  }

  if (!lesson.sections) {
    errors.push('sections object is missing');
    return { valid: false, errors };
  }

  let sectionTotal = 0;
  const sectionErrors = [];

  for (const [sectionName, expectedMinutes] of Object.entries(SECTION_DURATIONS)) {
    const section = lesson.sections[sectionName];
    if (!section) {
      sectionErrors.push(`Missing section: ${sectionName}`);
      continue;
    }
    const dur = section.durationMinutes;
    if (typeof dur !== 'number' || dur <= 0) {
      sectionErrors.push(`Section "${sectionName}" has invalid durationMinutes: ${dur}`);
    } else {
      sectionTotal += dur;
    }
  }

  if (sectionErrors.length > 0) {
    errors.push(...sectionErrors);
  }

  if (sectionTotal !== TOTAL_LESSON_DURATION) {
    errors.push(
      `Section durations sum to ${sectionTotal} minutes, expected ${TOTAL_LESSON_DURATION}`
    );
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate the structure of a generated lesson object.
 * @param {object} lesson
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateLessonStructure(lesson) {
  const errors = [];

  if (!lesson || typeof lesson !== 'object') {
    return { valid: false, errors: ['lesson must be a non-null object'] };
  }

  // Required top-level fields
  const requiredFields = ['title', 'learningObjective', 'totalDurationMinutes', 'sections'];
  for (const field of requiredFields) {
    if (lesson[field] === undefined || lesson[field] === null) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (errors.length > 0) return { valid: false, errors };

  // Duration validation
  const durationResult = validateTotalDuration(lesson);
  errors.push(...durationResult.errors);

  // Sections structural checks
  const sections = lesson.sections || {};

  if (sections.introduction) {
    if (!sections.introduction.overview) errors.push('introduction.overview is missing');
    if (!Array.isArray(sections.introduction.whatYouWillLearn)) {
      errors.push('introduction.whatYouWillLearn must be an array');
    }
  }

  if (sections.coreConcepts) {
    if (!Array.isArray(sections.coreConcepts.concepts) || sections.coreConcepts.concepts.length === 0) {
      errors.push('coreConcepts.concepts must be a non-empty array');
    }
  }

  if (sections.examples) {
    if (!Array.isArray(sections.examples.items) || sections.examples.items.length === 0) {
      errors.push('examples.items must be a non-empty array');
    }
  }

  if (sections.practicalDemonstration) {
    if (!Array.isArray(sections.practicalDemonstration.steps) || sections.practicalDemonstration.steps.length === 0) {
      errors.push('practicalDemonstration.steps must be a non-empty array');
    }
  }

  if (sections.knowledgeCheck) {
    if (!Array.isArray(sections.knowledgeCheck.questions) || sections.knowledgeCheck.questions.length === 0) {
      errors.push('knowledgeCheck.questions must be a non-empty array');
    } else {
      sections.knowledgeCheck.questions.forEach((q, i) => {
        if (!q.question) errors.push(`knowledgeCheck.questions[${i}].question is missing`);
        if (!q.correctAnswer) errors.push(`knowledgeCheck.questions[${i}].correctAnswer is missing`);
      });
    }
  }

  if (sections.summary) {
    if (!Array.isArray(sections.summary.keyTakeaways) || sections.summary.keyTakeaways.length === 0) {
      errors.push('summary.keyTakeaways must be a non-empty array');
    }
  }

  // YouTube and references arrays
  if (!Array.isArray(lesson.youtubeVideos)) {
    errors.push('youtubeVideos must be an array');
  }

  if (!Array.isArray(lesson.references)) {
    errors.push('references must be an array');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Full validation: structure + duration.
 * @param {object} lesson
 * @returns {{ valid: boolean, errors: string[], durationValid: boolean }}
 */
function validateLesson(lesson) {
  const structureResult = validateLessonStructure(lesson);
  const durationResult = validateTotalDuration(lesson);

  const allErrors = [...new Set([...structureResult.errors, ...durationResult.errors])];

  return {
    valid: allErrors.length === 0,
    errors: allErrors,
    durationValid: durationResult.valid,
    structureValid: structureResult.valid,
  };
}

module.exports = {
  LESSON_SCHEMA_TEMPLATE,
  SECTION_DURATIONS,
  TOTAL_LESSON_DURATION,
  validateLesson,
  validateLessonStructure,
  validateTotalDuration,
};
