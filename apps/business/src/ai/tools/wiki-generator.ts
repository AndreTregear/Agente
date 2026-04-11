/**
 * Wiki Generator — renders the knowledge graph into markdown files.
 *
 * The knowledge graph is the source of truth. Wiki files at
 * docs/knowledge-base/wiki/ are generated artifacts, regenerated
 * on demand or on a weekly schedule.
 *
 * Mapping:
 *   node_type 'decision'  → wiki/decisions/
 *   node_type 'pattern'   → wiki/patterns/
 *   node_type 'module'    → wiki/architecture/
 *   node_type 'event'     → wiki/sessions/
 *   node_type 'fact'      → wiki/patterns/  (facts are patterns-adjacent)
 *   node_type 'concept'   → wiki/architecture/
 *   node_type 'session'   → wiki/sessions/
 *
 * Run manually: npx tsx src/ai/tools/wiki-generator.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  getNodesByType,
  getAnnotations,
  getRelatedNodes,
  type KnowledgeNode,
  type NodeType,
} from '../../db/knowledge-repo.js';
import { logger } from '../../shared/logger.js';

// ── Type-to-Directory Mapping ──

const TYPE_DIR_MAP: Record<NodeType, string> = {
  decision: 'decisions',
  pattern: 'patterns',
  module: 'architecture',
  event: 'sessions',
  fact: 'patterns',
  concept: 'architecture',
  entity: 'architecture',
  session: 'sessions',
};

// ── Helpers ──

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

// ── Page Generation ──

async function generateNodePage(node: KnowledgeNode): Promise<string> {
  const annotations = await getAnnotations(node.id, 10);
  const related = await getRelatedNodes(node.id, undefined, 1);

  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: "${node.title.replace(/"/g, '\\"')}"`);
  lines.push(`type: ${node.nodeType}`);
  lines.push(`source: ${node.sourceType}${node.sourceRef ? `:${node.sourceRef.slice(0, 8)}` : ''}`);
  lines.push(`confidence: ${node.confidence}`);
  lines.push(`created: ${formatDate(node.createdAt)}`);
  lines.push(`updated: ${formatDate(node.updatedAt)}`);
  if (node.tags.length > 0) {
    lines.push(`tags: [${node.tags.map((t) => `"${t}"`).join(', ')}]`);
  }
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${node.title}`);
  lines.push('');

  // Metadata bar
  const metaParts = [
    `**Type:** ${node.nodeType}`,
    `**Source:** ${node.sourceType}${node.sourceRef ? ` \`${node.sourceRef.slice(0, 8)}\`` : ''}`,
    `**Confidence:** ${Math.round(node.confidence * 100)}%`,
    `**Created:** ${formatDate(node.createdAt)}`,
  ];
  lines.push(`> ${metaParts.join(' | ')}`);
  lines.push('');

  // Content
  lines.push(node.content);
  lines.push('');

  // Annotations
  if (annotations.length > 0) {
    lines.push('## Annotations');
    lines.push('');
    for (const ann of annotations) {
      const icon = ann.annotationType === 'insight' ? 'info'
        : ann.annotationType === 'correction' ? 'warning'
        : ann.annotationType === 'deprecation' ? 'x'
        : ann.annotationType === 'connection' ? 'link'
        : 'note';
      lines.push(`- **[${ann.annotationType}]** ${ann.content} _(${formatDate(ann.createdAt)}, ${ann.author})_`);
    }
    lines.push('');
  }

  // Related nodes
  if (related.length > 0) {
    lines.push('## Related');
    lines.push('');
    for (const rel of related) {
      const dir = TYPE_DIR_MAP[rel.node.nodeType] || 'architecture';
      const slug = slugify(rel.node.title);
      lines.push(`- **${rel.edge.relation}** → [${rel.node.title}](../${dir}/${slug}.md) _(${rel.node.nodeType}, confidence: ${Math.round(rel.node.confidence * 100)}%)_`);
    }
    lines.push('');
  }

  // Source metadata
  if (node.metadata && Object.keys(node.metadata).length > 0) {
    const meta = node.metadata as Record<string, unknown>;
    if (meta.commit_sha || meta.file_paths || meta.author) {
      lines.push('## Source Details');
      lines.push('');
      if (meta.commit_sha) lines.push(`- **Commit:** \`${(meta.commit_sha as string).slice(0, 8)}\``);
      if (meta.commit_subject) lines.push(`- **Subject:** ${meta.commit_subject}`);
      if (meta.author) lines.push(`- **Author:** ${meta.author}`);
      if (meta.date) lines.push(`- **Date:** ${formatDate(meta.date as string)}`);
      if (Array.isArray(meta.file_paths)) {
        lines.push(`- **Files:** ${(meta.file_paths as string[]).map((f) => `\`${f}\``).join(', ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateIndexPage(dirName: string, nodes: KnowledgeNode[]): string {
  const lines: string[] = [];

  const dirTitles: Record<string, string> = {
    architecture: 'Architecture & Modules',
    decisions: 'Architectural Decisions',
    patterns: 'Patterns & Facts',
    sessions: 'Events & Sessions',
    debugging: 'Debugging Notes',
    tools: 'Tools & Infrastructure',
  };

  lines.push(`# ${dirTitles[dirName] || dirName}`);
  lines.push('');
  lines.push(`> Auto-generated from the knowledge graph. ${nodes.length} entries.`);
  lines.push('');

  // Group by tags for better organization
  const byTag = new Map<string, KnowledgeNode[]>();
  for (const node of nodes) {
    const primaryTag = node.tags[0] || 'general';
    if (!byTag.has(primaryTag)) byTag.set(primaryTag, []);
    byTag.get(primaryTag)!.push(node);
  }

  for (const [tag, tagNodes] of Array.from(byTag.entries()).sort()) {
    lines.push(`## ${tag}`);
    lines.push('');
    for (const node of tagNodes.sort((a, b) => b.confidence - a.confidence)) {
      const slug = slugify(node.title);
      const confidence = Math.round(node.confidence * 100);
      const date = formatDate(node.createdAt);
      lines.push(`- [${node.title}](./${slug}.md) — ${node.summary || node.content.slice(0, 100)}... _(${date}, ${confidence}%)_`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

// ── Main Generator ──

export async function generateWiki(wikiRoot?: string): Promise<void> {
  const root = wikiRoot || path.resolve(process.cwd(), '../../docs/knowledge-base/wiki');

  logger.info({ wikiRoot: root }, 'Generating wiki from knowledge graph...');

  // Fetch all current platform-level nodes
  const allNodes = await getNodesByType(undefined, null, 500);

  if (allNodes.length === 0) {
    logger.info('No knowledge nodes found — wiki generation skipped');
    return;
  }

  // Group nodes by target directory
  const byDir = new Map<string, KnowledgeNode[]>();
  for (const node of allNodes) {
    const dir = TYPE_DIR_MAP[node.nodeType] || 'architecture';
    if (!byDir.has(dir)) byDir.set(dir, []);
    byDir.get(dir)!.push(node);
  }

  let pagesWritten = 0;

  for (const [dirName, nodes] of byDir) {
    const dirPath = path.join(root, dirName);
    fs.mkdirSync(dirPath, { recursive: true });

    // Generate individual pages
    for (const node of nodes) {
      try {
        const content = await generateNodePage(node);
        const slug = slugify(node.title);
        const filePath = path.join(dirPath, `${slug}.md`);
        fs.writeFileSync(filePath, content, 'utf-8');
        pagesWritten++;
      } catch (err) {
        logger.error({ nodeId: node.id, title: node.title, err }, 'Failed to generate wiki page');
      }
    }

    // Generate index page
    const indexContent = generateIndexPage(dirName, nodes);
    fs.writeFileSync(path.join(dirPath, 'README.md'), indexContent, 'utf-8');
  }

  // Generate top-level index
  const topIndex = [
    '# Yaya Knowledge Wiki',
    '',
    '> Auto-generated from the knowledge graph. Source of truth is the database, not these files.',
    '',
    `Last generated: ${new Date().toISOString()}`,
    '',
    '## Sections',
    '',
  ];

  for (const [dirName, nodes] of Array.from(byDir.entries()).sort()) {
    const dirTitles: Record<string, string> = {
      architecture: 'Architecture & Modules',
      decisions: 'Architectural Decisions',
      patterns: 'Patterns & Facts',
      sessions: 'Events & Sessions',
      debugging: 'Debugging Notes',
      tools: 'Tools & Infrastructure',
    };
    topIndex.push(`- [${dirTitles[dirName] || dirName}](./${dirName}/README.md) — ${nodes.length} entries`);
  }
  topIndex.push('');

  fs.writeFileSync(path.join(root, 'README.md'), topIndex.join('\n'), 'utf-8');
  pagesWritten++;

  logger.info({ pagesWritten, sections: byDir.size, totalNodes: allNodes.length }, 'Wiki generation complete');
}

// Allow running directly: npx tsx src/ai/tools/wiki-generator.ts
if (process.argv[1]?.endsWith('wiki-generator.ts') || process.argv[1]?.endsWith('wiki-generator.js')) {
  generateWiki()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Wiki generation failed:', err);
      process.exit(1);
    });
}
