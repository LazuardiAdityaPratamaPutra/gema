/** Tanda merek: lencana padat berhuruf "g", bukan gambar garis. */
export function Echo({ size = 28 }: { size?: number; className?: string }) {
  return (
    <span
      className="brandmark"
      style={{ width: size, height: size, fontSize: size * 0.62 }}
      aria-hidden="true"
    >
      g
    </span>
  );
}
