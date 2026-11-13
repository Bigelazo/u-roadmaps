export const problemReportLimits = {
  name: 120,
  email: 254,
  subject: 150,
  description: 5000,
} as const;

export const problemReportEmailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
