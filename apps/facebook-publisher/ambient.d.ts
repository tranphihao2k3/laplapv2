/**
 * Ambient type shims cho build CI không cài native.
 *
 * Khi dev thật chạy `npm install`, các package gốc (`electron`, `better-sqlite3`,
 * `playwright-core`, `electron-vite`, `@vitejs/plugin-react`) sẽ overwrite các
 * khai báo này — TypeScript sẽ ưu tiên `@types/*` thực.
 *
 * File này tồn tại để CI typecheck pass khi chưa có native binary.
 */
declare module "electron" {
  export interface IpcMainInvokeEvent {
    sender: any;
    frameId: number;
    processId: number;
  }
  export const app: any;
  export const BrowserWindow: any;
  export const contextBridge: any;
  export const ipcRenderer: any;
  export const ipcMain: any;
  export const dialog: any;
  export const shell: any;
  export const safeStorage: any;
  export const Menu: any;
  export const Tray: any;
  export const nativeImage: any;
  export const session: any;
  export const Notification: any;
}

declare module "better-sqlite3" {
  export interface DatabaseOpts {}
  export interface RunResult {
    changes: number;
    lastInsertRowid: number | bigint;
  }
  export class Statement {
    run(...params: unknown[]): RunResult;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    iterate(...params: unknown[]): IterableIterator<unknown>;
  }
  export class Database {
    constructor(filename: string, options?: DatabaseOpts);
    prepare(sql: string): Statement;
    exec(sql: string): Database;
    transaction<T extends (...args: any[]) => unknown>(fn: T): T;
    pragma(source: string, options?: { simple?: boolean }): unknown;
    close(): void;
  }
  export default Database;
}

declare module "playwright-core" {
  export class BrowserContext {
    cookies(): Promise<any[]>;
    pages(): Page[];
    newPage(): Promise<Page>;
    close(): Promise<void>;
  }
  export class Page {
    goto(url: string, options?: any): Promise<any>;
    locator(...args: any[]): any;
    fill(...args: any[]): Promise<void>;
    click(...args: any[]): Promise<void>;
    waitForSelector(...args: any[]): Promise<any>;
    waitForEvent(...args: any[]): Promise<any>;
    waitForTimeout(...args: any[]): Promise<void>;
    setContent(...args: any[]): Promise<void>;
    getByRole(...args: any[]): any;
    getByText(...args: any[]): any;
    evaluate<R = any>(fn: (...args: any[]) => R, ...args: any[]): Promise<R>;
    url(): string;
    close(): Promise<void>;
  }
  export class Browser {
    newContext(options?: any): Promise<BrowserContext>;
    close(): Promise<void>;
  }
  export interface LaunchOptions {
    headless?: boolean;
    args?: string[];
    executablePath?: string;
  }
  export const chromium: {
    launchPersistentContext(userDataDir: string, options?: LaunchOptions): Promise<BrowserContext>;
    launch(options?: LaunchOptions): Promise<Browser>;
  };
  export class Locator {
    first(): Locator;
    click(options?: any): Promise<void>;
    fill(value: string, options?: any): Promise<void>;
    waitFor(options?: any): Promise<void>;
    isVisible(...args: any[]): Promise<boolean>;
    textContent(): Promise<string | null>;
    count(): Promise<number>;
  }
}

declare module "electron-vite" {
  export const externalizeDepsPlugin: () => any;
  export function defineConfig<T = any>(config: T): T;
}
declare module "@vitejs/plugin-react" {
  const plugin: any;
  export default plugin;
}
declare module "vite/client" {}
declare module "react-router-dom" {
  export const BrowserRouter: any;
  export const Routes: any;
  export const Route: any;
  export const Link: any;
  export const NavLink: any;
  export const Outlet: any;
  export const Navigate: any;
  export const useNavigate: () => any;
  export const useLocation: () => any;
  export const useParams: () => any;
}
