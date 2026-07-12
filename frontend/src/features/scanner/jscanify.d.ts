declare module "jscanify/client" {
  export interface Point {
    x: number;
    y: number;
  }
  export interface CornerPoints {
    topLeftCorner?: Point;
    topRightCorner?: Point;
    bottomLeftCorner?: Point;
    bottomRightCorner?: Point;
  }
  export default class jscanify {
    constructor();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    findPaperContour(img: any): any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getCornerPoints(contour: any): CornerPoints;
    highlightPaper(
      image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      options?: { color?: string; thickness?: number }
    ): HTMLCanvasElement;
    extractPaper(
      image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: CornerPoints
    ): HTMLCanvasElement;
  }
}
