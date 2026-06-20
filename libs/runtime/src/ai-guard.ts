let aiGuardConfig: any = null;
let workspaceTypeContext: string = 'standalone';
let angularVersionContext: number = 19;

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

export async function analyzeViolationWithAi(violation: {
  ruleId: string;
  message: string;
  className: string;
  filePath?: string;
}) {
  if (!isAiGuardEnabled()) return;

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
