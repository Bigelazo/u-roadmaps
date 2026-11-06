// libavoid-js 0.4.5 points its exports at a missing declaration file. Keep the
// small, audited binding surface here instead of letting `any` escape the adapter.
declare module 'libavoid-js' {
  export interface NativeObject {
    readonly __class__: NativeClass;
  }
  export interface NativeClass {
    prototype: NativeObject;
  }
  export interface AvoidPoint extends NativeObject {
    x: number;
    y: number;
  }
  export interface AvoidPolygon extends NativeObject {
    size(): number;
    get_ps(index: number): AvoidPoint;
  }
  export type AvoidShape = NativeObject;
  export interface AvoidPin extends NativeObject {
    setExclusive(exclusive: boolean): void;
  }
  export interface AvoidConnector extends NativeObject {
    displayRoute(): AvoidPolygon;
    setRoutingType(type: number): void;
  }
  export interface AvoidRouter extends NativeObject {
    processTransaction(): void;
    moveShape(shape: AvoidShape, polygon: AvoidPolygon): void;
    deleteShape(shape: AvoidShape): void;
    deleteConnector(connector: AvoidConnector): void;
    setRoutingParameter(parameter: number, value: number): void;
    setRoutingOption(option: number, value: boolean): void;
  }
  export interface AvoidModule {
    Point: new (x: number, y: number) => AvoidPoint;
    Rectangle: new (topLeft: AvoidPoint, bottomRight: AvoidPoint) => AvoidPolygon;
    Router: new (flags: number) => AvoidRouter;
    ShapeRef: new (router: AvoidRouter, polygon: AvoidPolygon) => AvoidShape;
    ShapeConnectionPin: new (
      shape: AvoidShape,
      id: number,
      x: number,
      y: number,
      proportional: boolean,
      insideOffset: number,
      directions: number,
    ) => AvoidPin;
    ConnEnd: new (shape: AvoidShape, pinId: number) => NativeObject;
    ConnRef: new (
      router: AvoidRouter,
      source: NativeObject,
      target: NativeObject,
    ) => AvoidConnector;
    OrthogonalRouting: number;
    ConnType_Orthogonal: number;
    ConnDirUp: number;
    ConnDirRight: number;
    ConnDirDown: number;
    ConnDirLeft: number;
    segmentPenalty: number;
    shapeBufferDistance: number;
    idealNudgingDistance: number;
    nudgeSharedPathsWithCommonEndPoint: number;
    destroy(object: NativeObject): void;
    getPointer(object: NativeObject): number;
    getCache(type: NativeClass): Record<number, NativeObject>;
  }
  export const AvoidLib: {
    load(wasmPath: string): Promise<void>;
    getInstance(): AvoidModule;
  };
}
