import { useRef, useState } from 'react';
import { Button } from '~/shared/components/ui/button';
export function Signature({
  onChange,
}: {
  onChange: (f: File | undefined) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const generation = useRef(0);
  const [notice, setNotice] = useState('');
  return (
    <div>
      <p>Optional recipient signature. Draw below, then use the signature.</p>
      <canvas
        ref={canvas}
        width={560}
        height={180}
        aria-label="Draw recipient signature"
        className="h-auto w-full max-w-140 touch-none rounded-md border border-input bg-white text-black"
        onPointerDown={(e) => {
          generation.current++;
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const r = e.currentTarget.getBoundingClientRect();
          const c = e.currentTarget.getContext('2d')!;
          c.beginPath();
          c.moveTo(
            ((e.clientX - r.left) * 560) / r.width,
            ((e.clientY - r.top) * 180) / r.height,
          );
          onChange(undefined);
          setNotice('');
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const r = e.currentTarget.getBoundingClientRect();
          const c = e.currentTarget.getContext('2d')!;
          c.lineWidth = 3;
          c.lineCap = 'round';
          c.lineTo(
            ((e.clientX - r.left) * 560) / r.width,
            ((e.clientY - r.top) * 180) / r.height,
          );
          c.stroke();
          dirty.current = true;
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerCancel={() => {
          drawing.current = false;
        }}
      />
      <Button
        onClick={() => {
          if (!dirty.current) {
            setNotice('Draw a signature first.');
            return;
          }
          const current = ++generation.current;
          canvas.current?.toBlob((b) => {
            if (b && current === generation.current) {
              onChange(new File([b], 'signature.png', { type: 'image/png' }));
              setNotice('Signature selected.');
            }
          }, 'image/png');
        }}
      >
        Use signature
      </Button>
      <Button
        onClick={() => {
          canvas.current?.getContext('2d')?.clearRect(0, 0, 560, 180);
          generation.current++;
          dirty.current = false;
          onChange(undefined);
          setNotice('');
        }}
      >
        Clear signature
      </Button>
      <p role="status">{notice}</p>
    </div>
  );
}
