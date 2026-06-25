import { inferSectionType, parseElietHtml, slugify } from './parse-eliet-html';

const SAMPLE = `
<h2>Les pronoms</h2>
<p>Monokotuba: mono, lingala: ngai. Usage dans les phrases de conversation quotidienne.</p>
<h2>Lexique des termes usuels</h2>
<p>mbote = bonjour, nzila = route, yinzo = maison, zola = aimer.</p>
`;

describe('parse-eliet-html', () => {
  it('splits HTML by h2 sections', () => {
    const sections = parseElietHtml(SAMPLE);
    expect(sections.length).toBe(2);
    expect(sections[0].title).toMatch(/pronoms/i);
  });

  it('marks lexicon sections', () => {
    expect(inferSectionType('Lexique des termes usuels')).toBe('lexicon');
    expect(inferSectionType('Vocabulaire')).toBe('lexicon');
  });

  it('supports markdown heading input too', () => {
    const markdown = `
## Le Nom
Le nom ne possède pas de genre et cette section explique le pluriel.

## Vocabulaire
mbote = bonjour ; nkanda = lettre ; nzo = maison ; kwenda = aller.
`;
    const sections = parseElietHtml(markdown);
    expect(sections.length).toBe(2);
    expect(sections[1].type).toBe('lexicon');
  });

  it('slugifies accented titles', () => {
    expect(slugify("L'origine d'une langue")).toBe('l-origine-d-une-langue');
  });
});
