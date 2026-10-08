import 'server-only';
import { createHash } from 'node:crypto';

type ResourceContent = Readonly<{
  title: string;
  url: string;
  type: string;
  fileKey: string | null;
  fileContentType: string | null;
  updatedAt?: Date;
}>;

export function resourceContentState(resource: ResourceContent) {
  const fields = [
    resource.title,
    resource.url,
    resource.type,
    resource.fileKey,
    resource.fileContentType,
  ];
  const content = fields
    .map((value) => (value === null ? 'n' : `s${Buffer.byteLength(value, 'utf8')}:${value}`))
    .join('');
  return {
    title: resource.title,
    revision: `content-v1:${createHash('sha256').update(content).digest('hex')}`,
  };
}
