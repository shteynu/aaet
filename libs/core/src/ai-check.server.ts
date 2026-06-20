import * as fs from 'fs';
import * as path from 'path';

export interface AiCheckPayload {
  filePath?: string;
  className?: string;
  violationMessage?: string;
  ruleId?: string;
  customRules?: string;
  angularVersion?: number;
  workspaceType?: 'nx' | 'standalone';
  fullFileFix?: boolean;
}

/**
 * Node-compatible helper to securely run AI architectural analysis.
 * Can be wrapped inside an Express/Vite dev-server middleware.
 */
export async function handleAiCheckRequest(
  payload: AiCheckPayload,
  apiKeyOverride?: string,
  providerOverride?: 'anthropic' | 'openai'
): Promise<{ explanation: string; suggestion: string }> {
  const provider = providerOverride || (process.env.AAET_AI_PROVIDER as 'anthropic' | 'openai') || 'anthropic';
  const apiKey = apiKeyOverride || 
                 (provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY);

  if (!apiKey) {
    throw new Error(`Missing API key for provider "${provider}". Please set ANTHROPIC_API_KEY or OPENAI_API_KEY.`);
  }

  let fileContent = '';
  if (payload.filePath) {
    const fullPath = path.resolve(process.cwd(), payload.filePath);
    if (fs.existsSync(fullPath)) {
      fileContent = fs.readFileSync(fullPath, 'utf8');
    }
  }

  const customRulesText = payload.customRules ? `\nCustom Rules to enforce:\n${payload.customRules}` : '';
  const angularVersionText = payload.angularVersion ? `\nAngular Version: v${payload.angularVersion}` : '\nAngular Version: v19 (Default)';
  const workspaceTypeText = payload.workspaceType ? `\nWorkspace Type: ${payload.workspaceType}` : '';

  const fixInstructions = payload.fullFileFix
    ? `  - "suggestion": the ENTIRE refactored file content as a single valid TypeScript string. Do not truncate the file, omit sections, or add commentary. Return the complete, updated file content so it can overwrite the existing file directly.`
    : `  - "suggestion": a code snippet showing how to refactor the code to fix the violation. Do not explain the code snippet in text, just provide the correct code.`;

  const systemPrompt = `You are AAET AI Architect, a specialized assistant designed to review Angular code structure and explain runtime architectural violations.
Analyze the provided code and violation context.
Be concise. Focus on fixing the violation.
Follow these rules strictly:
- Check if it violates best practices for the specified Angular Version (${angularVersionText.trim()}) and Workspace (${workspaceTypeText.trim()}).
- Return your answer in standard JSON format containing exactly two keys:
  - "explanation": a clear, 2-3 sentence explanation of why the code is bad or why the violation occurred.
${fixInstructions}
${customRulesText}`;

  const userPrompt = `
Violation Type/Rule: ${payload.ruleId || 'N/A'}
Violation Message: ${payload.violationMessage || 'N/A'}
Class Name: ${payload.className || 'N/A'}
${fileContent ? `File Content:\n\`\`\`typescript\n${fileContent}\n\`\`\`` : ''}
`;

  let resultText = '';
  if (provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Claude API request failed with status ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    resultText = data.content?.[0]?.text || '';
  } else {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + '\nEnsure output is valid JSON.' },
          { role: 'user', content: userPrompt }
        ]
      })
    });
    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`OpenAI API request failed with status ${response.status}: ${errBody}`);
    }
    const data = await response.json();
    resultText = data.choices?.[0]?.message?.content || '';
  }

  try {
    let jsonStr = resultText.trim();
    if (jsonStr.startsWith('```json')) {
      jsonStr = jsonStr.substring(7);
    }
    if (jsonStr.endsWith('```')) {
      jsonStr = jsonStr.substring(0, jsonStr.length - 3);
    }
    const parsed = JSON.parse(jsonStr.trim());
    return {
      explanation: parsed.explanation || 'An architectural issue was detected.',
      suggestion: parsed.suggestion || ''
    };
  } catch (err) {
    return {
      explanation: resultText,
      suggestion: ''
    };
  }
}
