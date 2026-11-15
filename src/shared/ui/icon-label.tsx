import type { ReactNode } from 'react';

export function IconLabel({ icon, text }: Readonly<{ icon: ReactNode; text: string }>) {
  const [leadWord, rest] = splitLeadWord(text);
  return (
    <>
      <span data-slot="icon-label-lead" className="whitespace-nowrap">
        {icon}
        {leadWord}
      </span>
      {rest}
    </>
  );
}

function splitLeadWord(text: string): readonly [string, string] {
  const boundary = text.search(/\s/);
  return boundary === -1 ? [text, ''] : [text.slice(0, boundary), text.slice(boundary)];
}
