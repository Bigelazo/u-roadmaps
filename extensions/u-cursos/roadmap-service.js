(() => {
  const uRoadmapsOrigin = 'https://roadmap.dcc.uchile.cl';
  const viewHash = '#u-roadmaps';
  const serviceName = 'U-Roadmaps';
  const neighbourService = 'servicio_material_docente';
  const unreadCountRequestType = 'u-roadmaps/unread-notification-count';
  const unreadCountRefreshMs = 60_000;
  const maxDisplayedUnreadCount = 99;
  const coursePagePath = /^\/[^/]+\/(\d{4})\/([12])\/([^/]+)\/\d+\//;

  function courseOffering(pathname) {
    const match = coursePagePath.exec(pathname);
    if (!match) return null;
    const [, year, semester, courseCode] = match;
    return { courseCode: decodeURIComponent(courseCode).toUpperCase(), year, semester };
  }

  function embeddedRoadmapUrl({ courseCode, year, semester }) {
    return `${uRoadmapsOrigin}/embed/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`;
  }

  function createServiceItem() {
    const item = document.createElement('li');
    item.className = 'servicio servicio_u_roadmaps';
    const link = document.createElement('a');
    link.href = viewHash;
    const iconFrame = document.createElement('span');
    iconFrame.className = 'u-roadmaps-icon';
    const icon = document.createElement('img');
    icon.alt = '';
    icon.src = chrome.runtime.getURL('icons/network.svg');
    const badge = document.createElement('span');
    badge.className = 'u-roadmaps-badge';
    badge.setAttribute('aria-hidden', 'true');
    badge.hidden = true;
    iconFrame.append(icon, badge);
    const label = document.createElement('span');
    label.textContent = serviceName;
    link.append(iconFrame, ' ', label);
    item.append(link);
    return { item, link, badge };
  }

  function unreadBadge({ link, badge }) {
    return {
      show(unread) {
        if (!Number.isInteger(unread) || unread <= 0) {
          badge.hidden = true;
          badge.textContent = '';
          link.removeAttribute('aria-label');
          return;
        }
        const notifications = unread === 1 ? 'notificación sin leer' : 'notificaciones sin leer';
        badge.textContent =
          unread > maxDisplayedUnreadCount ? `${maxDisplayedUnreadCount}+` : String(unread);
        badge.hidden = false;
        link.setAttribute('aria-label', `${serviceName}, ${unread} ${notifications}`);
      },
    };
  }

  function requestUnreadCount(offering) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: unreadCountRequestType, offering }, (response) => {
          resolve(chrome.runtime.lastError ? null : (response?.unread ?? null));
        });
      } catch {
        resolve(null);
      }
    });
  }

  function unreadCountWatcher(offering, badge) {
    let latestRequest = 0;

    async function refresh() {
      const request = ++latestRequest;
      const unread = await requestUnreadCount(offering);
      if (request === latestRequest) badge.show(unread);
    }

    function refreshWhileVisible() {
      if (document.visibilityState === 'visible') refresh();
    }

    function refreshAfterLeavingRoadmap(event) {
      const leftRoadmap = new URL(event.oldURL).hash === viewHash && location.hash !== viewHash;
      if (leftRoadmap) refresh();
    }

    return {
      start() {
        refresh();
        setInterval(refreshWhileVisible, unreadCountRefreshMs);
        document.addEventListener('visibilitychange', refreshWhileVisible);
        window.addEventListener('hashchange', refreshAfterLeavingRoadmap);
      },
    };
  }

  function placeServiceItem(services, item) {
    const neighbour = services.querySelector(`:scope > li.${neighbourService}`);
    if (neighbour) neighbour.after(item);
    else services.append(item);
  }

  function createRoadmapFrame(offering) {
    const frame = document.createElement('iframe');
    frame.className = 'u-roadmaps-frame';
    frame.title = `Roadmap de ${offering.courseCode}`;
    frame.src = embeddedRoadmapUrl(offering);
    return frame;
  }

  function roadmapView({ services, item, content, offering }) {
    const previouslySelected = services.querySelector(':scope > li.sel');
    const sectionTitles = [
      ...document.querySelectorAll('#navigation > h1.modulo, #navbar > li:last-child'),
    ].map((element) => ({ element, original: element.textContent }));
    let frame = null;
    let hiddenContent = [];

    function show() {
      if (frame) return;
      previouslySelected?.classList.remove('sel');
      item.classList.add('sel');
      for (const { element } of sectionTitles) element.textContent = serviceName;
      hiddenContent = [...content.children].filter((child) => !child.hidden);
      for (const child of hiddenContent) child.hidden = true;
      frame = createRoadmapFrame(offering);
      content.append(frame);
    }

    function hide() {
      if (!frame) return;
      frame.remove();
      frame = null;
      for (const child of hiddenContent) child.hidden = false;
      hiddenContent = [];
      item.classList.remove('sel');
      previouslySelected?.classList.add('sel');
      for (const { element, original } of sectionTitles) element.textContent = original;
    }

    return { sync: () => (location.hash === viewHash ? show() : hide()) };
  }

  function install() {
    const offering = courseOffering(location.pathname);
    const services = document.querySelector('ul.modulos');
    const content = document.getElementById('body');
    if (!offering || !services || !content) return;

    const { item, link, badge } = createServiceItem();
    placeServiceItem(services, item);
    const view = roadmapView({ services, item, content, offering });
    window.addEventListener('hashchange', view.sync);
    view.sync();
    unreadCountWatcher(offering, unreadBadge({ link, badge })).start();
  }

  install();
})();
