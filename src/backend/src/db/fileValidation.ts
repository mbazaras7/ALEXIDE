export const isValidPath = (path: string): boolean => {
  //Must start with /, no double slashes, no trailing slash (except root)
  return /^\/([^/]+\/)*[^/]*$/.test(path) && !path.includes('//');
};

export const getFileExtension = (filename: string): string => {
  const lastDot = filename.lastIndexOf('.');
  return lastDot > 0 ? filename.slice(lastDot + 1) : '';
};

export const getMimeType = (filename: string): string => {
  const ext = getFileExtension(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    py: 'text/x-python',
    json: 'application/json',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
};
