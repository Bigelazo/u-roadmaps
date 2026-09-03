// Compatibility surface for the resource lifecycle, which moves in #54.
export * from '@/features/roadmap/application/roadmap';
export {
  applicationErrorResponse as apiErrorResponse,
  handleApplicationResult as handleApiResult,
  parseJsonObject as parseJson,
  throwApplicationError as throwApiError,
} from '@/app/_adapters/http';
