import {
  Download,
  ExternalLink,
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

export function resourceActionLabel(resource: Pick<Resource, 'type' | 'title'>) {
  return resource.type === 'FILE'
    ? `Descargar ${resource.title}`
    : `Abrir enlace ${resource.title}`;
}

export function ResourceActionIcon({
  type,
  size,
  className,
}: {
  type: Resource['type'];
  size?: number;
  className?: string;
}) {
  const Icon = type === 'FILE' ? Download : ExternalLink;
  return <Icon size={size} className={className} aria-hidden="true" />;
}
