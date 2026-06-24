const path = require('path');
const express = require('express');
const cors = require('cors');

const app = express();
const publicDir = path.join(__dirname, 'public');
const nodePattern = /^[A-Z]->[A-Z]$/;

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '100kb' }));
app.use(express.static(publicDir));

function readIdentity() {
  const fullName = (process.env.BFHL_FULL_NAME || 'jasmeen singh').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
  const dob = (process.env.BFHL_DOB_DDMMYYYY || '03112003').trim();

  return {
    user_id: `${fullName || 'jasmeensingh'}_${dob || '03112003'}`,
    email_id: process.env.BFHL_EMAIL_ID || 'jasmeen1941.be23@chitkara.edu.in',
    college_roll_number: process.env.BFHL_ROLL_NUMBER || '2310991941'
  };
}

function normalizeEntry(entry) {
  if (typeof entry !== 'string') {
    return String(entry ?? '').trim();
  }

  return entry.trim();
}

function buildResponse(data) {
  const invalidEntries = [];
  const duplicateEdges = [];
  const duplicateSeen = new Set();
  const seenEdges = new Set();
  const childToParent = new Map();
  const childrenByParent = new Map();
  const nodes = new Set();
  const firstSeenIndex = new Map();

  data.forEach((item, index) => {
    const entry = normalizeEntry(item);
    const parts = entry.split('->');

    if (!nodePattern.test(entry) || parts[0] === parts[1]) {
      invalidEntries.push(entry);
      return;
    }

    if (seenEdges.has(entry)) {
      if (!duplicateSeen.has(entry)) {
        duplicateSeen.add(entry);
        duplicateEdges.push(entry);
      }
      return;
    }

    seenEdges.add(entry);

    const [parent, child] = parts;

    nodes.add(parent);
    nodes.add(child);

    if (!firstSeenIndex.has(parent)) {
      firstSeenIndex.set(parent, index);
    }

    if (!firstSeenIndex.has(child)) {
      firstSeenIndex.set(child, index);
    }

    if (childToParent.has(child)) {
      return;
    }

    childToParent.set(child, parent);

    if (!childrenByParent.has(parent)) {
      childrenByParent.set(parent, []);
    }

    childrenByParent.get(parent).push(child);
  });

  const dsuParent = new Map();

  function find(node) {
    const currentParent = dsuParent.get(node);

    if (currentParent === node) {
      return node;
    }

    const root = find(currentParent);
    dsuParent.set(node, root);
    return root;
  }

  function union(left, right) {
    const rootLeft = find(left);
    const rootRight = find(right);

    if (rootLeft !== rootRight) {
      dsuParent.set(rootRight, rootLeft);
    }
  }

  for (const node of nodes) {
    dsuParent.set(node, node);
  }

  for (const [parent, children] of childrenByParent.entries()) {
    for (const child of children) {
      union(parent, child);
    }
  }

  const components = new Map();

  for (const node of nodes) {
    const root = find(node);

    if (!components.has(root)) {
      components.set(root, {
        nodes: new Set(),
        minIndex: Number.POSITIVE_INFINITY
      });
    }

    const component = components.get(root);
    component.nodes.add(node);
    component.minIndex = Math.min(component.minIndex, firstSeenIndex.get(node) ?? Number.POSITIVE_INFINITY);
  }

  function componentHasCycle(componentNodes) {
    const visitState = new Map();

    function visit(node) {
      const state = visitState.get(node) || 0;

      if (state === 1) {
        return true;
      }

      if (state === 2) {
        return false;
      }

      visitState.set(node, 1);

      const children = childrenByParent.get(node) || [];
      for (const child of children) {
        if (componentNodes.has(child) && visit(child)) {
          return true;
        }
      }

      visitState.set(node, 2);
      return false;
    }

    for (const node of componentNodes) {
      if (visit(node)) {
        return true;
      }
    }

    return false;
  }

  function buildTree(node, path = new Set()) {
    if (path.has(node)) {
      return {};
    }

    path.add(node);
    const children = childrenByParent.get(node) || [];
    const nodeTree = {};

    for (const child of children) {
      nodeTree[child] = buildTree(child, path);
    }

    path.delete(node);
    return nodeTree;
  }

  function depthOf(node, memo = new Map()) {
    if (memo.has(node)) {
      return memo.get(node);
    }

    const children = childrenByParent.get(node) || [];

    if (children.length === 0) {
      memo.set(node, 1);
      return 1;
    }

    let deepest = 0;
    for (const child of children) {
      deepest = Math.max(deepest, depthOf(child, memo));
    }

    const result = deepest + 1;
    memo.set(node, result);
    return result;
  }

  const hierarchies = [];
  let totalTrees = 0;
  let totalCycles = 0;
  let largestTreeRoot = '';
  let largestTreeDepth = 0;

  const sortedComponents = Array.from(components.values()).sort((left, right) => {
    if (left.minIndex !== right.minIndex) {
      return left.minIndex - right.minIndex;
    }

    const leftRoot = Array.from(left.nodes).sort()[0] || '';
    const rightRoot = Array.from(right.nodes).sort()[0] || '';
    return leftRoot.localeCompare(rightRoot);
  });

  for (const component of sortedComponents) {
    const componentNodes = component.nodes;
    const hasCycle = componentHasCycle(componentNodes);
    const rootCandidates = Array.from(componentNodes).filter((node) => !childToParent.has(node));
    const sortedNodes = Array.from(componentNodes).sort();
    const root = hasCycle
      ? sortedNodes[0] || ''
      : (rootCandidates.sort()[0] || sortedNodes[0] || '');

    if (hasCycle) {
      totalCycles += 1;
      hierarchies.push({
        root,
        tree: {},
        has_cycle: true
      });
      continue;
    }

    const tree = { [root]: buildTree(root) };
    const depth = depthOf(root);

    totalTrees += 1;
    hierarchies.push({
      root,
      tree,
      depth
    });

    if (depth > largestTreeDepth || (depth === largestTreeDepth && root.localeCompare(largestTreeRoot) < 0)) {
      largestTreeDepth = depth;
      largestTreeRoot = root;
    }
  }

  return {
    ...readIdentity(),
    hierarchies,
    invalid_entries: invalidEntries,
    duplicate_edges: duplicateEdges,
    summary: {
      total_trees: totalTrees,
      total_cycles: totalCycles,
      largest_tree_root: largestTreeRoot
    }
  };
}

app.get('/health', (_request, response) => {
  response.json({ status: 'ok' });
});

app.post('/bfhl', (request, response) => {
  const { data } = request.body || {};

  if (!Array.isArray(data)) {
    return response.status(400).json({
      error: 'Request body must include a data array.'
    });
  }

  try {
    response.json(buildResponse(data));
  } catch (error) {
    response.status(500).json({
      error: 'Unable to process the request.',
      details: error.message
    });
  }
});

app.get('/api/identity', (_request, response) => {
  response.json(readIdentity());
});

app.get('*', (_request, response) => {
  response.sendFile(path.join(publicDir, 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`BFHL app listening on port ${port}`);
});
