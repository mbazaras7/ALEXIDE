import * as monaco from 'monaco-editor';

export function getOrCreateModel(
  monacoInstance: typeof monaco,
  value: string,
  language: string,
  path: string
): monaco.editor.ITextModel {
  const uri = monacoInstance.Uri.parse(
    path || 'inmemory://model/' + Math.random().toString(36).slice(2)
  );
  let model = monacoInstance.editor.getModel(uri);

  if (!model) {
    model = monacoInstance.editor.createModel(value, language, uri);
  }

  return model;
}
