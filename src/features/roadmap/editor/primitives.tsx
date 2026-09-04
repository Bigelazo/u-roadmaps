import type { RoadmapDto } from '@/features/roadmap/types';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select';

export const inputClassName = 'h-11';

export function NodeTypeSelect({
  id,
  nodeTypes,
  value,
  onValueChange,
}: {
  id: string;
  nodeTypes: RoadmapDto['nodeTypes'];
  value: string;
  onValueChange: (value: string) => void;
}) {
  return (
    <Select value={value} onValueChange={(nextValue) => nextValue && onValueChange(nextValue)}>
      <SelectTrigger id={id} className={inputClassName}>
        <SelectValue placeholder="Selecciona un tipo">
          {(selectedNodeTypeId: string | null) =>
            nodeTypes.find((type) => type.id === selectedNodeTypeId)?.name ?? 'Selecciona un tipo'
          }
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {nodeTypes.map((type) => (
            <NodeTypeOption key={type.id} type={type} />
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function NodeTypeOption({ type }: { type: RoadmapDto['nodeTypes'][number] }) {
  return (
    <SelectItem value={type.id}>
      <span className="flex items-center gap-2">
        <NodeTypeIcon
          icon={type.icon}
          className="size-4"
          style={{ color: type.color }}
          aria-hidden="true"
        />
        {type.name}
      </span>
    </SelectItem>
  );
}
