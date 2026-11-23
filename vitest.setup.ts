import "@testing-library/jest-dom/vitest";

// jsdom không implement sẵn các API mà trình duyệt có — stub tối thiểu để
// các component dùng IntersectionObserver / matchMedia chạy được trong test.
class NoopObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

globalThis.IntersectionObserver =
  globalThis.IntersectionObserver ?? (NoopObserver as unknown as typeof IntersectionObserver);

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = NoopObserver as unknown as typeof ResizeObserver;
}
