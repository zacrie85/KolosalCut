// NOVACUT Studio - Pembungkus teks kanvas (word wrap) yang dipakai
// bersama oleh engine timeline & template cover.
// Kata yang lebih lebar dari layar (mis. judul panjang tanpa spasi)
// dipecah per karakter agar SEMUA teks tetap terbaca di layar.

export interface WrapOptions {
  /** batas jumlah baris; baris terakhir diberi tanda … bila terpotong */
  maxLines?: number;
}

export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, opts?: WrapOptions): string[] {
  if (!text) return [];
  maxWidth = Math.max(8, maxWidth);

  /** pecah satu kata terlalu panjang per karakter (atau per potongan yang muat) */
  const hardBreak = (word: string): string[] => {
    if (ctx.measureText(word).width <= maxWidth) return [word];
    const out: string[] = [];
    let cur = "";
    for (const ch of [...word]) {
      const test = cur + ch;
      if (cur && ctx.measureText(test).width > maxWidth) {
        out.push(cur);
        cur = ch;
      } else {
        cur = test;
      }
    }
    if (cur) out.push(cur);
    return out;
  };

  const lines: string[] = [];
  for (const raw of text.split("\n")) {
    const words = raw.split(/\s+/).filter(Boolean);
    let cur = "";
    for (const word of words) {
      // kata tunggal melebihi lebar layar -> pecah per karakter
      const pieces = !cur && ctx.measureText(word).width > maxWidth ? hardBreak(word) : [word];
      for (const piece of pieces) {
        const test = cur ? `${cur} ${piece}` : piece;
        if (ctx.measureText(test).width > maxWidth && cur) {
          lines.push(cur);
          cur = piece;
        } else {
          cur = test;
        }
      }
    }
    if (cur) lines.push(cur);
  }
  if (!lines.length) lines.push("");

  const maxLines = opts?.maxLines;
  if (maxLines && lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s+\S*$/, "") + "…";
    return kept;
  }
  return lines;
}
