import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export type ParsedSection = {
  slug: string;
  title: string;
  content: string;
  type: 'grammar' | 'lexicon' | 'cultural_note';
  section: string;
};

const MIN_CONTENT_LENGTH = 40;

export function inferSectionType(title: string): ParsedSection['type'] {
  const normalized = title.toLowerCase();
  if (/lexique|vocabulaire/.test(normalized)) return 'lexicon';
  if (/preface|préface|origine|conclusion/.test(normalized)) return 'cultural_note';
  return 'grammar';
}

export function slugify(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return slug || 'section';
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>');
}

function sanitizeHtmlBody(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|tr|h3|h4|h5|h6)>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

function sanitizeMarkdownBody(value: string): string {
  return value
    .replace(/\r/g, '')
    .replace(/^[ \t]*---[ \t]*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseHtmlSections(html: string): ParsedSection[] {
  const headingRegex = /<h([23])[^>]*>([\s\S]*?)<\/h\1>/gi;
  const matches = Array.from(html.matchAll(headingRegex));

  return matches
    .map((match, index) => {
      const title = sanitizeHtmlBody(match[2] ?? 'section');
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? html.length;
      const body = sanitizeHtmlBody(html.slice(start, end));
      const section = slugify(title);
      return {
        slug: section,
        title,
        content: body,
        type: inferSectionType(title),
        section,
      };
    })
    .filter((section) => section.content.length >= MIN_CONTENT_LENGTH);
}

function parseMarkdownSections(markdown: string): ParsedSection[] {
  const headingRegex = /^(#{2,3})\s+(.+?)\s*$/gm;
  const matches = Array.from(markdown.matchAll(headingRegex));

  return matches
    .map((match, index) => {
      const title = (match[2] ?? 'section').trim();
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? markdown.length;
      const body = sanitizeMarkdownBody(markdown.slice(start, end));
      const section = slugify(title);
      return {
        slug: section,
        title,
        content: body,
        type: inferSectionType(title),
        section,
      };
    })
    .filter((section) => section.content.length >= MIN_CONTENT_LENGTH);
}

function ensureUniqueSlugs(sections: ParsedSection[]): ParsedSection[] {
  const seen = new Map<string, number>();

  return sections.map((section) => {
    const count = seen.get(section.slug) ?? 0;
    seen.set(section.slug, count + 1);
    if (count === 0) return section;

    const slug = `${section.slug}-${count + 1}`;
    return { ...section, slug, section: slug };
  });
}

export function parseElietHtml(html: string): ParsedSection[] {
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '');

  const parsed = /<h2[^>]*>/i.test(cleaned)
    ? parseHtmlSections(cleaned)
    : parseMarkdownSections(cleaned);

  return ensureUniqueSlugs(parsed);
}

async function main() {
  const input = resolve(process.argv[2] ?? '../data/cultural/raw/monokotuba.html');
  const outDir = resolve(process.argv[3] ?? '../data/cultural/processed/eliet-1953');
  await mkdir(outDir, { recursive: true });
  const existing = await readdir(outDir);
  await Promise.all(
    existing
      .filter((file) => file.endsWith('.md'))
      .map((file) => unlink(join(outDir, file))),
  );

  const html = await readFile(input, 'utf8');
  const sections = parseElietHtml(html);

  for (const section of sections) {
    const frontmatter = [
      '---',
      `type: ${section.type}`,
      'languages: [kit, lin]',
      `section: ${section.section}`,
      `source: eliet-1953://${section.section}`,
      '---',
      '',
    ].join('\n');
    await writeFile(
      join(outDir, `${section.slug}.md`),
      `${frontmatter}# ${section.title}\n\n${section.content}\n`,
    );
  }

  console.log(`Wrote ${sections.length} sections to ${outDir}`);
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  });
}
