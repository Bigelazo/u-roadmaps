import {
  Download,
  ExternalLink,
  Eye,
  File,
  FileArchive,
  FileCode,
  FileHeadphone,
  FileImage,
  FilePlay,
  FileSpreadsheet,
  FileText,
  FileType,
  Link2,
  Presentation,
  type LucideIcon,
} from 'lucide-react';
import {
  resourceCategory,
  resourcePreviewKind,
  type ResourceCategory,
} from '@/features/roadmap/domain/resource-file-category';
import type { Resource } from '@/features/roadmap/types';

const categoryIcons: Record<ResourceCategory, LucideIcon> = {
  link: Link2,
  pdf: FileText,
  presentation: Presentation,
  spreadsheet: FileSpreadsheet,
  document: FileType,
  archive: FileArchive,
  image: FileImage,
  video: FilePlay,
  audio: FileHeadphone,
  code: FileCode,
  file: File,
};

export function ResourceIcon({
  resource,
  size = 20,
  className,
}: {
  resource: Pick<Resource, 'type' | 'title' | 'fileContentType'>;
  size?: number;
  className?: string;
}) {
  const Icon = categoryIcons[resourceCategory(resource)];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

export function ResourceActionIcon({
  resource,
  size,
  className,
}: {
  resource: Pick<Resource, 'type' | 'title' | 'fileContentType'>;
  size?: number;
  className?: string;
}) {
  const Icon =
    resource.type === 'LINK' ? ExternalLink : resourcePreviewKind(resource) ? Eye : Download;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
