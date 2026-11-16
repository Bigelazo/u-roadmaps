import 'driver.js/dist/driver.css';
import './tutorial.css';

import { driver } from 'driver.js';
import { tutorialDriverConfig } from './tutorial-session';

export function highlightTutorialTrigger(selector: string) {
  const tour = driver({
    ...tutorialDriverConfig,
    showButtons: ['next', 'close'],
    doneBtnText: 'Entendido',
  });
  tour.highlight({
    element: selector,
    popover: {
      title: 'Tutorial',
      description: 'Puedes repetir el tutorial cuando quieras desde este ícono.',
      side: 'bottom',
      showButtons: ['next', 'close'],
      nextBtnText: 'Entendido',
      onNextClick: () => tour.destroy(),
    },
  });
  return () => tour.destroy();
}
