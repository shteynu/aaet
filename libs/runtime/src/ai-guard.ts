let aiGuardConfig: any = null;
let workspaceTypeContext: string = 'standalone';
let angularVersionContext: number = 19;

let violationCounter = 0;
const pendingViolations = new Map<number, {
  ruleId: string;
  message: string;
  className: string;
  filePath?: string;
}>();

// Queue and Deduplication Middleware State
const recentlyAnalyzedViolations = new Set<string>();
let activeRequestPromise: Promise<any> | null = null;
const requestQueue: Array<{
  violation: any;
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

async function enqueueAiAnalysis(violation: {
  ruleId: string;
  message: string;
  className: string;
  filePath?: string;
}): Promise<any> {
  const violationKey = `${violation.ruleId}::${violation.className}`;
  if (recentlyAnalyzedViolations.has(violationKey)) {
    console.log(`🤖 [AAET AI] Skipping duplicate analysis for violation key: ${violationKey}`);
    return Promise.resolve({ explanation: 'Duplicate skipped (already analyzed)', suggestion: '' });
  }

  // Also prevent duplicates currently sitting in the queue
  const isDuplicateInQueue = requestQueue.some(
    (item) => item.violation.ruleId === violation.ruleId && item.violation.className === violation.className
  );
  if (isDuplicateInQueue) {
    console.log(`🤖 [AAET AI] Skipping duplicate queue item for: ${violationKey}`);
    return Promise.resolve({ explanation: 'Duplicate skipped (in queue)', suggestion: '' });
  }

  recentlyAnalyzedViolations.add(violationKey);

  return new Promise((resolve, reject) => {
    requestQueue.push({ violation, resolve, reject });
    processQueue();
  });
}

function processQueue() {
  if (activeRequestPromise || requestQueue.length === 0) {
    return;
  }

  const { violation, resolve, reject } = requestQueue.shift()!;
  
  activeRequestPromise = executeAiAnalysis(violation)
    .then((result) => {
      resolve(result);
    })
    .catch((err) => {
      reject(err);
    })
    .finally(() => {
      activeRequestPromise = null;
      processQueue();
    });
}

// Expose manual analysis command globally
if (typeof globalThis !== 'undefined') {
  const g = globalThis as any;
  g.aaet = g.aaet || {};
  g.aaet.analyze = async (id: number) => {
    const violation = pendingViolations.get(id);
    if (!violation) {
      console.error(`❌ [AAET] Violation with ID ${id} not found or already analyzed.`);
      return;
    }
    console.log(`🤖 [AAET AI] Running on-demand analysis for ID ${id}...`);
    const result = await enqueueAiAnalysis(violation);
    pendingViolations.delete(id);
    return result;
  };
}

export function setupAiGuard(config: any, angularCore?: any) {
  if (!config || !config.enabled) {
    return;
  }
  aiGuardConfig = config;
  if (config.workspaceType) {
    workspaceTypeContext = config.workspaceType;
  }
  if (config.angularVersion) {
    angularVersionContext = config.angularVersion;
  }
  console.warn('🤖 [AAET] Runtime AI Guard is active. Listening for architectural violations to analyze.');
}

export function isAiGuardEnabled() {
  return !!(aiGuardConfig && aiGuardConfig.enabled);
}

async function executeAiAnalysis(violation: {
  ruleId: string;
  message: string;
  className: string;
  filePath?: string;
}) {
  const payload = {
    ruleId: violation.ruleId,
    violationMessage: violation.message,
    className: violation.className,
    filePath: violation.filePath,
    customRules: aiGuardConfig.customRules,
    angularVersion: angularVersionContext,
    workspaceType: workspaceTypeContext
  };

  console.log(`🤖 [AAET AI] Analyzing violation "${violation.ruleId}" for class "${violation.className}"...`);

  try {
    let explanation = '';
    let suggestion = '';

    if (aiGuardConfig.endpointUrl) {
      const response = await fetch(aiGuardConfig.endpointUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(`AI Check proxy returned status ${response.status}`);
      }
      const data = await response.json();
      explanation = data.explanation;
      suggestion = data.suggestion;
    } else if (aiGuardConfig.apiKey) {
      const provider = aiGuardConfig.provider || 'anthropic';
      const systemPrompt = `You are AAET AI Architect. Return a JSON object with keys: "explanation" and "suggestion" for fixing the violation.`;
      const userPrompt = JSON.stringify(payload);

      if (provider === 'anthropic') {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-api-key': aiGuardConfig.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-5-sonnet-20241022',
            max_tokens: 1000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          })
        });
        const data = await response.json();
        const text = data.content?.[0]?.text || '{}';
        const parsed = JSON.parse(text);
        explanation = parsed.explanation;
        suggestion = parsed.suggestion;
      } else {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'authorization': `Bearer ${aiGuardConfig.apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ]
          })
        });
        const data = await response.json();
        const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}');
        explanation = parsed.explanation;
        suggestion = parsed.suggestion;
      }
    } else {
      console.warn('⚠️ [AAET AI] No endpointUrl or apiKey configured for AI Guard.');
      return;
    }

    console.group(`🤖 [AAET AI Analysis: ${violation.ruleId}]`);
    console.log(`%cExplanation:`, 'color: #e67e22; font-weight: bold;');
    console.log(explanation);
    if (suggestion) {
      console.log(`%cSuggested Refactoring:`, 'color: #2ecc71; font-weight: bold;');
      console.log(suggestion);
    }
    console.groupEnd();

    return { explanation, suggestion };

  } catch (err: any) {
    console.error(`❌ [AAET AI] Failed to run AI runtime check: ${err.message}`);
    return null;
  }
}

export async function analyzeViolationWithAi(violation: {
  ruleId: string;
  message: string;
  className: string;
  filePath?: string;
}) {
  if (!isAiGuardEnabled()) return;

  let autoAnalyze = true;
  if (aiGuardConfig.autoAnalyze !== undefined) {
    autoAnalyze = aiGuardConfig.autoAnalyze;
  } else {
    const isTestEnv = typeof process !== 'undefined' && (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') || !!(globalThis as any).vitest;
    autoAnalyze = isTestEnv;
  }

  if (autoAnalyze) {
    return enqueueAiAnalysis(violation);
  } else {
    violationCounter++;
    pendingViolations.set(violationCounter, violation);

    console.warn(`⚠️ [AAET Violation] ${violation.ruleId} detected on "${violation.className}": ${violation.message}`);
    console.log(
      `%c🤖 Click/run aaet.analyze(${violationCounter}) in the console for AI recommendations & code fixes`,
      'background: #2ecc71; color: white; padding: 4px 8px; border-radius: 4px; font-weight: bold; cursor: pointer;'
    );
  }
}
