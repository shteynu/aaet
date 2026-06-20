import { analyzeViolationWithAi, isAiGuardEnabled } from './ai-guard';
import { getRuntimeConfig, isConfiguredCheckerEnabled, isConfiguredRuleEnabled } from './config-state';

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
      
      const isVerifyEnabled = getRuntimeConfig() === null || (
        isConfiguredCheckerEnabled('ai') && isConfiguredRuleEnabled('ai', 'AI_VERIFY_DECORATOR')
      );

      if (isAiGuardEnabled() && isVerifyEnabled && !checked) {
        checked = true;
        void analyzeViolationWithAi({
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
