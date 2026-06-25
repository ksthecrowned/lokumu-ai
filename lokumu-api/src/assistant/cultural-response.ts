import { RagSearchResult } from '../rag/rag.service';
import { InternalLanguage } from '../shared/i18n/languages';
import { isSimpleGreetingQuery } from './cultural-router';

function readMetadata(item: RagSearchResult): Record<string, unknown> {
  if (
    typeof item.metadata === 'object' &&
    item.metadata &&
    !Array.isArray(item.metadata)
  ) {
    return item.metadata as Record<string, unknown>;
  }
  return {};
}

function splitProverbContent(
  content: string,
  metadata: Record<string, unknown> = {},
): {
  phrase: string;
  translation?: string;
} {
  const frMatch = content.match(/\(FR:\s*([^)]+)\)/i);
  const phrase = content
    .replace(/\(FR:[^)]+\)/gi, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)[0];

  const translation =
    frMatch?.[1]?.trim() ??
    (typeof metadata.translation_fr === 'string'
      ? metadata.translation_fr
      : undefined);

  return {
    phrase: phrase || content.trim(),
    translation,
  };
}

function hasNativePhrase(content: string): boolean {
  const { phrase } = splitProverbContent(content);
  return phrase.length > 0 && !/^\(FR:/i.test(phrase);
}

function extractLookupTerm(prompt: string): string | null {
  const match = prompt.trim().match(
    /(?:comment dit-on|how do you say|traduire|translate)\s+(.+)\??$/i,
  );
  if (!match?.[1]) return null;

  return match[1]
    .trim()
    .toLowerCase()
    .replace(/[?.!]+$/, '')
    .trim()
    .replace(
      /\s+en\s+(kituba|kitúba|lingala|lingála|français|francais|anglais|english)\s*$/i,
      '',
    )
    .trim();
}

function resolveExpressionTranslation(
  source: RagSearchResult,
  allSources: RagSearchResult[],
): string | undefined {
  const metadata = readMetadata(source);
  const fromContent = splitProverbContent(source.content, metadata).translation;
  if (fromContent) return fromContent;

  const title = metadata.title;
  const frSibling = allSources.find((item) => {
    const itemMeta = readMetadata(item);
    return (
      itemMeta.title === title &&
      /\(FR:/i.test(item.content) &&
      item.id !== source.id
    );
  });
  if (frSibling) {
    return splitProverbContent(frSibling.content, readMetadata(frSibling))
      .translation;
  }

  const titleLower = String(title ?? '').toLowerCase();
  if (titleLower.includes('remerc')) return 'Merci beaucoup.';
  if (titleLower.includes('de rien')) return 'De rien.';
  if (titleLower.includes('pardon') || titleLower.includes('excuse')) {
    return 'Pardon / excuse-moi.';
  }
  if (titleLower.includes('salut') || source.content.toLowerCase().includes('mbote')) {
    return 'Bonjour.';
  }

  return undefined;
}

function pickBestExpressionSource(
  sources: RagSearchResult[],
  lookupTerm: string | null,
): RagSearchResult | null {
  if (sources.length === 0) return null;

  const ranked = [...sources].sort((a, b) => {
    const aNative = hasNativePhrase(a.content);
    const bNative = hasNativePhrase(b.content);
    if (aNative !== bNative) return Number(bNative) - Number(aNative);

    if (lookupTerm) {
      return (
        scoreSourceForLookup(b, lookupTerm) - scoreSourceForLookup(a, lookupTerm)
      );
    }

    return b.score - a.score;
  });

  return ranked[0] ?? null;
}

function resolveProverbTranslation(
  source: RagSearchResult,
  allSources: RagSearchResult[],
): string | undefined {
  const metadata = readMetadata(source);
  const fromContent = splitProverbContent(source.content, metadata).translation;
  if (fromContent) return fromContent;

  const title = metadata.title;
  const frSibling = allSources.find((item) => {
    const itemMeta = readMetadata(item);
    return (
      itemMeta.title === title &&
      /\(FR:/i.test(item.content) &&
      item.id !== source.id
    );
  });
  if (frSibling) {
    return splitProverbContent(frSibling.content, readMetadata(frSibling))
      .translation;
  }

  const titleText = String(title ?? '').trim();
  if (titleText && titleText !== 'Corpus culturel') {
    return titleText;
  }

  return undefined;
}

export type GroundedCulturalResult = {
  response: string;
  source: RagSearchResult | null;
};

export function buildDemoFallbackResponse(
  responseLanguage: InternalLanguage,
  prompt: string,
): string {
  if (responseLanguage === 'fra') {
    return [
      'Je suis Lokumu, assistant culturel congolais (100 % local).',
      '',
      'Je peux vous aider avec des proverbes, salutations et traductions en lingala ou kituba.',
      '',
      'Essayez par exemple :',
      '• Donne-moi un proverbe lingala',
      '• Comment dit-on merci en kituba ?',
      '• Comment dit-on bonjour en kituba ?',
    ].join('\n');
  }

  if (responseLanguage === 'eng') {
    return [
      'I am Lokumu, a local Congolese cultural assistant.',
      '',
      'Try asking for a Lingala proverb or a Kituba translation.',
    ].join('\n');
  }

  return `Lokumu : ${prompt}`;
}

function formatSimpleGreeting(
  responseLanguage: InternalLanguage,
): GroundedCulturalResult {
  const response =
    responseLanguage === 'fra'
      ? [
          'Mbote ! Bienvenue sur Lokumu.',
          '',
          'Je peux vous aider avec :',
          '• des proverbes lingala ou kituba',
          '• des traductions (merci, bonjour, salutations…)',
          '',
          'Cliquez un exemple ci-dessous ou posez votre question.',
        ].join('\n')
      : responseLanguage === 'eng'
        ? 'Hello! I am Lokumu, your local Congolese cultural assistant. Ask me for proverbs or Kituba/Lingala expressions.'
        : 'Mbote ! Lokumu awa. Botuna proverbe to libondeli na lingala to kituba.';

  return { response, source: null };
}

export function formatGroundedProverbResponse(
  source: RagSearchResult,
  responseLanguage: InternalLanguage,
  allSources: RagSearchResult[] = [],
): string {
  const { phrase, translation: inlineTranslation } = splitProverbContent(
    source.content,
    readMetadata(source),
  );
  const translation =
    inlineTranslation ?? resolveProverbTranslation(source, allSources);

  if (responseLanguage === 'fra') {
    const lines = ['Voici un proverbe lingala du corpus Lokumu :', '', phrase];
    if (translation) {
      lines.push('', `Traduction : ${translation}`);
    }
    return lines.join('\n');
  }

  if (responseLanguage === 'eng') {
    const lines = ['Here is a Lingala proverb from the Lokumu corpus:', '', phrase];
    if (translation) {
      lines.push('', `Meaning: ${translation}`);
    }
    return lines.join('\n');
  }

  if (responseLanguage === 'lin') {
    const lines = ['Lobi ndakisa moko ya lingala na corpus Lokumu :', '', phrase];
    if (translation) {
      lines.push('', `(FR: ${translation})`);
    }
    return lines.join('\n');
  }

  const lines = ['Lobi ndakisa moko na corpus Lokumu :', '', phrase];
  if (translation) {
    lines.push('', `(FR: ${translation})`);
  }
  return lines.join('\n');
}

function scoreSourceForLookup(
  source: RagSearchResult,
  lookupTerm: string,
): number {
  const metadata = readMetadata(source);
  const title = String(metadata.title ?? '').toLowerCase();
  const tags = Array.isArray(metadata.tags)
    ? metadata.tags.map((tag) => String(tag).toLowerCase()).join(' ')
    : '';
  const translation = String(metadata.translation_fr ?? '').toLowerCase();
  const content = source.content.toLowerCase();
  let score = 0;

  if (title.includes(lookupTerm)) score += 3;
  if (tags.includes(lookupTerm)) score += 2;
  if (translation.includes(lookupTerm)) score += 2;
  if (content.includes(lookupTerm)) score += 1;

  if (lookupTerm.includes('merci') && title.includes('remerc')) score += 3;
  if (lookupTerm.includes('merci') && translation.includes('merci')) score += 2;
  if (lookupTerm.includes('mbote') && (title.includes('salut') || tags.includes('salutation'))) {
    score += 2;
  }
  if (/bonjour|salut|hello|hi/.test(lookupTerm)) {
    if (String(readMetadata(source).type ?? '') === 'greeting') score += 4;
    if (content.includes('mbote')) score += 3;
    if (translation.includes('bonjour')) score += 3;
    if (title.includes('salut')) score += 2;
  }

  return score;
}

export function formatGroundedExpressionResponse(
  source: RagSearchResult,
  prompt: string,
  responseLanguage: InternalLanguage,
  allSources: RagSearchResult[] = [],
): string {
  const lookupTerm = extractLookupTerm(prompt) ?? 'cette expression';
  const targetLanguage =
    /kituba/i.test(prompt) ? 'kituba' : /lingala/i.test(prompt) ? 'lingala' : 'la langue demandee';
  const { phrase } = splitProverbContent(source.content, readMetadata(source));
  const translation = resolveExpressionTranslation(source, allSources);

  if (responseLanguage === 'fra') {
    const lines = [
      `En ${targetLanguage}, pour dire « ${lookupTerm} » :`,
      '',
      phrase,
    ];
    if (translation) {
      lines.push('', `→ ${translation}`);
    }
    return lines.join('\n');
  }

  if (responseLanguage === 'eng') {
    const lines = [
      `In ${targetLanguage}, to say "${lookupTerm}":`,
      '',
      phrase,
    ];
    if (translation) {
      lines.push('', `→ ${translation}`);
    }
    return lines.join('\n');
  }

  return [phrase, translation ? `(FR: ${translation})` : ''].filter(Boolean).join('\n');
}

export function buildGroundedResponse(
  sources: RagSearchResult[],
  prompt: string,
  responseLanguage: InternalLanguage,
): GroundedCulturalResult | null {
  if (isSimpleGreetingQuery(prompt)) {
    return formatSimpleGreeting(responseLanguage);
  }

  if (sources.length === 0) return null;

  const proverbQuery = /proverbe|proverb|ndakisa/i.test(prompt);
  const translationQuery = /comment dit-on|how do you say|traduire|translate/i.test(prompt);

  if (translationQuery) {
    const lookupTerm = extractLookupTerm(prompt);
    const expressionSources = sources.filter((item) => {
      const type = String(readMetadata(item).type ?? '');
      return ['expression', 'greeting', 'dialogue'].includes(type);
    });

    const pool = expressionSources.length > 0 ? expressionSources : sources;
    const best = pickBestExpressionSource(pool, lookupTerm);

    if (best && (!lookupTerm || scoreSourceForLookup(best, lookupTerm) > 0)) {
      return {
        source: best,
        response: formatGroundedExpressionResponse(
          best,
          prompt,
          responseLanguage,
          sources,
        ),
      };
    }
  }

  const proverbSources = sources.filter((item) => {
    const type = String(readMetadata(item).type ?? '');
    return proverbQuery || type === 'proverb';
  });

  if (proverbSources.length === 0) return null;

  const best =
    proverbSources.find((item) => hasNativePhrase(item.content)) ??
    proverbSources[0];

  return {
    source: best,
    response: formatGroundedProverbResponse(best, responseLanguage, sources),
  };
}

export function tryFormatGroundedResponse(
  sources: RagSearchResult[],
  prompt: string,
  responseLanguage: InternalLanguage,
): string | null {
  return buildGroundedResponse(sources, prompt, responseLanguage)?.response ?? null;
}
