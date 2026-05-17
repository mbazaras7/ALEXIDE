export interface FileNode {
  id: string;
  name: string;
  path: string;
  isDirectory: boolean;
  children?: FileNode[];
  parentId?: string | null;
}

export const cleanFileTree = (files: FileNode[]): FileNode[] => {
  const allChildIds = new Set<string>();

  const collectChildIds = (nodes: FileNode[]) => {
    nodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => allChildIds.add(child.id));
        collectChildIds(node.children);
      }
    });
  };

  collectChildIds(files);

  const sortNodes = (nodes: FileNode[]): FileNode[] =>
    nodes
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: node.children ? sortNodes(node.children) : undefined,
      }));

  return sortNodes(files.filter((file) => !allChildIds.has(file.id)));
};

export const findNodeInTree = (nodes: FileNode[], nodeId: string): FileNode | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    if (node.children) {
      const found = findNodeInTree(node.children, nodeId);
      if (found) return found;
    }
  }
  return null;
};

export const isAncestor = (nodes: FileNode[], ancestorId: string, nodeId: string): boolean => {
  for (const node of nodes) {
    if (node.id === ancestorId) {
      const findInChildren = (children: FileNode[]): boolean =>
        children.some((c) => c.id === nodeId || (c.children ? findInChildren(c.children) : false));
      return node.children ? findInChildren(node.children) : false;
    }
    if (node.children && isAncestor(node.children, ancestorId, nodeId)) return true;
  }
  return false;
};
