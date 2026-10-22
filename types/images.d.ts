declare module "jpeg-js" {
  export function decode(
    buffer: Buffer,
    options?: { useTArray?: boolean },
  ): {
    width: number;
    height: number;
    data: Uint8Array;
  };
}
