declare module "jscanify/client" {
  export default class jscanify {
    constructor();
    highlightPaper(
      image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      options?: { color?: string; thickness?: number }
    ): HTMLCanvasElement;
    extractPaper(
      image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      resultWidth: number,
      resultHeight: number
    ): HTMLCanvasElement;
  }
}
