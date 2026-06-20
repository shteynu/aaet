import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';
import { globalRuntimeConfig } from './config-state';

export interface AiVerifyOptions {
  customRules?: string;
  filePath?: string;
}

/**
 * Decorator that triggers a real-time AI architectural assessment on component/service instantiation.
 */
export function AiVerify(options: AiVerifyOptions = {}) {
  return function(target: any) {
    const original = target;

    let checked = false;
    const newConstructor: any = function(...args: any[]) {
      const instance = new original(...args);
      
      const isVerifyEnabled = globalRuntimeConfig ? (globalRuntimeConfig.checkers?.runtime?.enabled !== false && globalRuntimeConfig.checkers?.runtime?.rules?.['AI_VERIFY_DECORATOR'] !== false) : true;

      if (isAiGuardEnabled() && isVerifyEnabled && !checked) {
        checked = true;
        analyzeViolationWithAi({
          ruleId: 'AI_VERIFY_DECORATOR',
          message: `Class "${target.name}" is decorated with @AiVerify. Perform a general review of its design pattern and modern Angular usage.`,
          className: target.name,
          filePath: options.filePath
        });
      }

      return instance;
    };

    newConstructor.prototype = original.prototype;
    return newConstructor;
  };
}
