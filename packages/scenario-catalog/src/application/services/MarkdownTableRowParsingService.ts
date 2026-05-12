export class MarkdownTableRowParsingService {
  parse(row: string): string[] {
    const normalizedRow = row.trim().replace(/^\|/, '').replace(/\|$/, '');
    const cells: string[] = [];
    let currentCell = '';

    for (let index = 0; index < normalizedRow.length; index += 1) {
      const character = normalizedRow[index];
      const nextCharacter = normalizedRow[index + 1];

      if (character === '\\' && nextCharacter === '|') {
        currentCell += '|';
        index += 1;
        continue;
      }

      if (character === '|') {
        cells.push(currentCell.trim());
        currentCell = '';
        continue;
      }

      currentCell += character;
    }

    cells.push(currentCell.trim());
    return cells;
  }
}
