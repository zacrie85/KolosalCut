/**
 * HudCorners — empat sudut kurung ala HUD sci-fi untuk membingkai panel.
 */
export function HudCorners({ className = "" }: { className?: string }) {
  const c = "absolute w-3.5 h-3.5 border-cyan-300/80 pointer-events-none";
  return (
    <span aria-hidden className={`pointer-events-none absolute inset-0 z-10 ${className}`}>
      <span className={`${c} top-0 left-0 border-t-2 border-l-2 rounded-tl-[2px]`} />
      <span className={`${c} top-0 right-0 border-t-2 border-r-2 rounded-tr-[2px]`} />
      <span className={`${c} bottom-0 left-0 border-b-2 border-l-2 rounded-bl-[2px]`} />
      <span className={`${c} bottom-0 right-0 border-b-2 border-r-2 rounded-br-[2px]`} />
    </span>
  );
}
