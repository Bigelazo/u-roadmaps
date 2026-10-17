import { expect, test } from 'vitest';
import { decideNodeTypeChange, type NodeTypeChange } from '@/features/roadmap/domain/node-type';

const nodeTypes = [
  { id: 'content', name: 'Contenido', isPredefined: true },
  { id: 'workshop', name: 'Taller', isPredefined: false },
  { id: 'project', name: 'Proyecto', isPredefined: false },
];
const nodes = [{ nodeTypeId: 'content' }, { nodeTypeId: 'project' }];

const notFound = {
  reason: 'NODE_TYPE_NOT_FOUND',
  message: 'El tipo no existe o no está disponible en este roadmap.',
};
const immutable = {
  reason: 'PREDEFINED_TYPE_IMMUTABLE',
  message: 'Los tipos predefinidos son inmutables.',
};
const nameConflict = {
  reason: 'NODE_TYPE_NAME_CONFLICT',
  message: 'Ya existe un tipo disponible con ese nombre.',
};
const inUse = {
  reason: 'NODE_TYPE_IN_USE',
  message: 'No se puede eliminar un tipo utilizado por nodos.',
};

test.each<[string, NodeTypeChange, { reason: string; message: string } | null]>([
  ['creates a Node type with a new name', { kind: 'create', name: 'Ejercicio' }, null],
  [
    'rejects creating a Node type named like a predefined one, normalized',
    { kind: 'create', name: '  CONTENIDO ' },
    nameConflict,
  ],
  [
    'rejects creating a Node type named like one of the Roadmap, normalized',
    { kind: 'create', name: 'taller' },
    nameConflict,
  ],
  [
    'renames a Node type of the Roadmap',
    { kind: 'update', nodeTypeId: 'workshop', name: 'Laboratorio' },
    null,
  ],
  [
    'keeps the name of a Node type when only its case changes',
    { kind: 'update', nodeTypeId: 'workshop', name: 'TALLER' },
    null,
  ],
  [
    'changes only the appearance of a Node type of the Roadmap',
    { kind: 'update', nodeTypeId: 'workshop' },
    null,
  ],
  [
    'rejects renaming a Node type to the name of another one, normalized',
    { kind: 'update', nodeTypeId: 'workshop', name: 'proyecto' },
    nameConflict,
  ],
  [
    'rejects renaming a predefined Node type',
    { kind: 'update', nodeTypeId: 'content', name: 'Lectura' },
    immutable,
  ],
  [
    'rejects changing the appearance of a predefined Node type',
    { kind: 'update', nodeTypeId: 'content' },
    immutable,
  ],
  [
    'rejects updating a Node type outside the Roadmap',
    { kind: 'update', nodeTypeId: 'missing', name: 'Lectura' },
    notFound,
  ],
  ['deletes a Node type that no Node uses', { kind: 'delete', nodeTypeId: 'workshop' }, null],
  ['rejects deleting a Node type that Nodes use', { kind: 'delete', nodeTypeId: 'project' }, inUse],
  [
    'rejects deleting a predefined Node type, used or not',
    { kind: 'delete', nodeTypeId: 'content' },
    immutable,
  ],
  [
    'rejects deleting a Node type outside the Roadmap',
    { kind: 'delete', nodeTypeId: 'missing' },
    notFound,
  ],
])('%s', (_case, change, rejection) => {
  expect(decideNodeTypeChange({ nodeTypes, nodes, change })).toEqual(
    rejection ? { kind: 'REJECTED', ...rejection } : { kind: 'ALLOWED' },
  );
});
