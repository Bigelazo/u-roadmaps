const emptyRectangles = Object.assign([], { item: () => null }) as unknown as DOMRectList;

if (typeof Range !== 'undefined') {
  Range.prototype.getClientRects ??= () => emptyRectangles;
  Range.prototype.getBoundingClientRect ??= () => new DOMRect();
}
