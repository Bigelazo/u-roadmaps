'use client';

import { useRef } from 'react';
import { domAnimation, LazyMotion, type MotionValue, useScroll, useTransform } from 'motion/react';
import * as m from 'motion/react-m';
import { cn } from 'cn';

const sizes = {
  statement:
    'max-w-[24ch] text-[1.75rem] leading-[1.15] tracking-[-0.03em] sm:text-[2.5rem] sm:leading-[1.1] lg:max-w-[28ch] lg:text-[3.5rem] lg:leading-[1.05] lg:tracking-[-0.04em]',
  feature:
    'max-w-[22ch] text-[1.75rem] leading-[1.15] tracking-[-0.03em] xl:text-[2.25rem] xl:leading-[1.1]',
  support: 'max-w-[30ch] text-2xl leading-[1.2] tracking-[-0.02em] xl:text-[1.75rem]',
} as const;

function keywordMarkedWords(text: string) {
  let insideKeyword = false;
  return text.split(' ').map((marked) => {
    if (marked.startsWith('[')) insideKeyword = true;
    const word = { text: marked.replace(/[[\]]/g, ''), keyword: insideKeyword };
    if (marked.includes(']')) insideKeyword = false;
    return word;
  });
}

function Word({
  text,
  className,
  progress,
  range,
}: {
  text: string;
  className?: string;
  progress: MotionValue<number>;
  range: [number, number];
}) {
  const opacity = useTransform(progress, range, [0.28, 1]);
  return (
    <>
      <m.span style={{ opacity }} className={cn('whitespace-nowrap', className)}>
        {text}
      </m.span>{' '}
    </>
  );
}

export function RevealStatement({
  text,
  size = 'statement',
  className,
  keywordClassName = 'text-primary',
}: {
  text: string;
  size?: keyof typeof sizes;
  className?: string;
  keywordClassName?: string;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const words = keywordMarkedWords(text);

  return (
    <LazyMotion features={domAnimation} strict>
      <p
        ref={ref}
        className={cn('font-heading font-semibold text-pretty text-ink', sizes[size], className)}
      >
        {words.map((word, index) => (
          <Word
            key={`${word.text}-${index}`}
            text={word.text}
            className={word.keyword ? keywordClassName : undefined}
            progress={scrollYProgress}
            range={[index / words.length, (index + 1) / words.length]}
          />
        ))}
      </p>
    </LazyMotion>
  );
}
