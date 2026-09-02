import type { RoadmapDto } from '@/lib/roadmap-types';
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
            <SelectItem key={type.id} value={type.id}>
              <span className="flex items-center gap-2">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: type.color }}
                  aria-hidden="true"
                />
                {type.name}
              </span>
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
