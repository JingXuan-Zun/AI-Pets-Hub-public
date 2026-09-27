import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const STORY_DIRECTORY = path.resolve('src/components/chat/story');
const SOURCE_PATTERN = /\.(?:ts|tsx)$/u;

function isFunctionNode(node: ts.Node): node is ts.FunctionLikeDeclaration {
  return ts.isFunctionDeclaration(node)
    || ts.isFunctionExpression(node)
    || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node);
}

function collectLongFunctions(filePath: string, text: string) {
  const kind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true, kind);
  const failures: string[] = [];
  const visit = (node: ts.Node) => {
    if (isFunctionNode(node) && node.body) {
      const start = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      const end = source.getLineAndCharacterOfPosition(node.end).line + 1;
      if (end - start + 1 > 50) failures.push(`${path.basename(filePath)}:${start} (${end - start + 1} 行)`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return failures;
}

const files = fs.readdirSync(STORY_DIRECTORY).filter((name) => SOURCE_PATTERN.test(name));
const longFiles: string[] = [];
const longFunctions: string[] = [];
files.forEach((name) => {
  const filePath = path.join(STORY_DIRECTORY, name);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split(/\r?\n/u).length;
  if (lines > 300) longFiles.push(`${name} (${lines} 行)`);
  longFunctions.push(...collectLongFunctions(filePath, text));
});

assert.deepEqual(longFiles, [], `故事源码文件超过 300 行：${longFiles.join('、')}`);
assert.deepEqual(longFunctions, [], `故事源码函数超过 50 行：${longFunctions.join('、')}`);
console.log(`story code rules smoke: PASS (${files.length} files)`);
