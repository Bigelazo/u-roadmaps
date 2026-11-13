import { animate } from 'motion/react';
import { practiceNodeIds } from './practice-roadmap';

export function pulseControlDependencies() {
  const pulses = [4, 5, 6].flatMap((id) => {
    const path = document.querySelector<SVGPathElement>(
      `.react-flow__edge[data-id="practice-dependency-${id}"] .react-flow__edge-path`,
    );
    if (!path) return [];
    const pulse = path.cloneNode(false) as SVGPathElement;
    pulse.removeAttribute('id');
    pulse.removeAttribute('class');
    pulse.setAttribute('data-tutorial-dependency-pulse', practiceNodeIds.e);
    pulse.setAttribute('pathLength', '1');
    pulse.setAttribute('stroke-dasharray', '0.12 1');
    pulse.style.stroke = 'var(--primary)';
    pulse.style.strokeWidth = '3';
    pulse.style.opacity = '0';
    pulse.style.pointerEvents = 'none';
    path.parentElement?.appendChild(pulse);
    const animation = animate(0, 1.12, {
      duration: 1.2,
      ease: [0.4, 0, 0.2, 1],
      onUpdate: (progress) => {
        pulse.setAttribute('stroke-dashoffset', String(0.12 - progress));
        pulse.style.opacity = String(
          Math.max(0, Math.min(1, progress / 0.08, (1.12 - progress) / 0.12)),
        );
      },
      onComplete: () => pulse.remove(),
    });
    return [{ pulse, animation }];
  });
  return () => {
    for (const { pulse, animation } of pulses) {
      animation.stop();
      pulse.remove();
    }
  };
}
