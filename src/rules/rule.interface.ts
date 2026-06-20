import * as ts from 'typescript';
import { ConfigManager } from '../context/config-manager';

export interface Violation {
  ruleId: string;
  message: string;
  file: string;
  line: number;
  character: number;
}

export interface RuleContext {
  sourceFile: ts.SourceFile;
  filePath: string;
  configManager: ConfigManager;
}

export interface Rule {
  run(context: RuleContext): Violation[];
}

export function getLineAndCharacter(sourceFile: ts.SourceFile, node: ts.Node) {
  const { line, character } = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart(sourceFile));
  return { line: line + 1, character: character + 1 }; // 1-indexed for readability
}
