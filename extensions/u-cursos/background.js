const uRoadmapsOrigin = 'https://roadmap.dcc.uchile.cl';
const uCursosOrigin = 'https://www.u-cursos.cl';
const unreadCountRequestType = 'u-roadmaps/unread-notification-count';
const courseCodePattern = /^[A-Z0-9][A-Z0-9_-]{0,31}$/;
const yearPattern = /^\d{4}$/;
const semesterPattern = /^[12]$/;

function isFromUCursosTab(sender) {
  if (sender.id !== chrome.runtime.id || !sender.tab || !sender.url) return false;
  try {
    return new URL(sender.url).origin === uCursosOrigin;
  } catch {
    return false;
  }
}

function courseOfferingFrom(message) {
  if (message?.type !== unreadCountRequestType) return null;
  const { courseCode, year, semester } = message.offering ?? {};
  const isValid =
    typeof courseCode === 'string' &&
    typeof year === 'string' &&
    typeof semester === 'string' &&
    courseCodePattern.test(courseCode) &&
    yearPattern.test(year) &&
    semesterPattern.test(semester);
  return isValid ? { courseCode, year, semester } : null;
}

function unreadCountUrl({ courseCode, year, semester }) {
  const path = ['api', courseCode, year, semester, 'notifications', 'count']
    .map(encodeURIComponent)
    .join('/');
  return new URL(`/${path}`, uRoadmapsOrigin);
}

async function fetchUnreadCount(offering) {
  try {
    const response = await fetch(unreadCountUrl(offering), {
      credentials: 'include',
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const { unread } = await response.json();
    return Number.isInteger(unread) && unread >= 0 ? unread : null;
  } catch {
    return null;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const offering = courseOfferingFrom(message);
  if (!offering || !isFromUCursosTab(sender)) return false;
  fetchUnreadCount(offering).then((unread) => sendResponse({ unread }));
  return true;
});
