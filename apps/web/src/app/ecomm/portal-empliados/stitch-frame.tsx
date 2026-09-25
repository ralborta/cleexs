'use client';

type StitchFrameProps = {
  src: string;
  title: string;
};

/** Renderiza el HTML de Stitch (aside ya removido) a full height. */
export function StitchFrame({ src, title }: StitchFrameProps) {
  return (
    <iframe
      title={title}
      src={src}
      className="h-[calc(100vh-3.5rem)] w-full border-0 bg-[#faf8ff]"
      sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
    />
  );
}
