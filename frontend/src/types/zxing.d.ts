declare module '@zxing/browser' {
  export class BrowserQRCodeReader {
    constructor()
    decodeFromVideoElement(
      videoElement: HTMLVideoElement,
      callback: (result: any, error: any) => void
    ): Promise<void>
    reset(): void
  }
  export class BrowserMultiFormatReader {
    constructor()
    decodeFromVideoElement(
      videoElement: HTMLVideoElement,
      callback: (result: any, error: any) => void
    ): Promise<{ stop(): void }>
  }
}
