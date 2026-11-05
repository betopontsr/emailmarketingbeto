/** Links dos anexos (docs/fontes). */
export const LINKS = {
  main47: "https://go.centerpag.com/PPU38CQFMQH",
  main27: "https://go.centerpag.com/PPU38CQFMQG",
  nathan67: "https://go.centerpag.com/PPU38CQFMSE",
  nathan47: "https://go.centerpag.com/PPU38CQGGFQ",
  knots47: "https://go.centerpag.com/PPU38CQFMS1",
  knots19: "https://go.centerpag.com/PPU38CQFMS2",
  reclaim97: "https://go.centerpag.com/PPU38CQFMS7",
  reclaim47: "https://go.centerpag.com/PPU38CQFMS9",
} as const;

export type LinkKey = keyof typeof LINKS;

/** Troca um link de checkout conhecido por um link de redirecionamento no domínio do app (/r/<chave>). */
export function redirectLink(url: string, linkBase: string | null): string {
  if (!linkBase) return url;
  const key = (Object.keys(LINKS) as LinkKey[]).find((k) => LINKS[k] === url);
  return key ? `${linkBase}/r/${key}` : url;
}
