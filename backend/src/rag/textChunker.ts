export function chunkText(text: string, chunkSize = 700, overlap = 120): string[] {
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (!cleanText) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < cleanText.length) {
    const end = Math.min(start + chunkSize, cleanText.length);
    const chunk = cleanText.slice(start, end).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    if (end >= cleanText.length) {
      break;
    }

    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}
