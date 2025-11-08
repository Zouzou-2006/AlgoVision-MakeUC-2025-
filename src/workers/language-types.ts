import type { Tree } from 'web-tree-sitter';
import type { IRDocument, Diagnostic } from '../core/ir';
import type { SupportedLanguage } from './ts-init';

export type AnalyzeOptions = {
  maxNodes?: number;
  includeClassDiagram?: boolean;
  includeCallGraph?: boolean;
};

export type LanguageWorkerContext = {
  tree: Tree;
  text: string;
  docId: string;
  language: SupportedLanguage;
  options?: AnalyzeOptions;
};

export type LanguageAnalyzerResult = {
  ir: IRDocument;
  diagnostics: Diagnostic[];
};

export type LanguageAnalyzer = (ctx: LanguageWorkerContext) => Promise<LanguageAnalyzerResult> | LanguageAnalyzerResult;
