export class MarkdownTableRowParsingService {
  parse(row: string): string[] {
    return row
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((cell) => cell.trim());
  }
}
