import * as monaco from 'monaco-editor';

export function setLanguage(model: monaco.editor.ITextModel, language: string) {
  const monacoInstance = monaco as typeof import('monaco-editor');
  monacoInstance.editor.setModelLanguage(model, language);
}

export function setTheme(monacoInstance: typeof monaco, theme: string) {
  monacoInstance.editor.setTheme(theme);
}
