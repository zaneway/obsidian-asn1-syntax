// 扩展Obsidian类型定义
declare module 'obsidian' {
  export interface App {
    workspace: Workspace;
  }

  export interface Workspace {
    on(name: 'editor-change', callback: (editor: Editor) => any): EventRef;
    on(name: 'editor-save', callback: (editor: Editor) => any): EventRef;
    on(name: 'file-open', callback: () => any): EventRef;
    on(name: 'active-leaf-change', callback: () => any): EventRef;
    offref(ref: EventRef): void;
    getActiveViewOfType<T extends View>(type: new (...args: any[]) => T): T | null;
  }

  export interface View {
    // 基础视图接口
  }

  export interface MarkdownView extends View {
    editor: Editor;
  }

  export abstract class Plugin {
    app: App;
    manifest: PluginManifest;
    
    constructor(app: App, manifest: PluginManifest);
    
    onload(): Promise<void> | void;
    onunload(): void;
    
    register(callback: () => void): void;
    registerEvent(ref: EventRef): void;
    registerMarkdownCodeBlockProcessor(
      language: string, 
      processor: (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => void
    ): void;
    addCommand(command: Command): void;
    addSettingTab(tab: PluginSettingTab): void;
    loadData(): Promise<any>;
    saveData(data: any): Promise<void>;
  }

  export interface PluginManifest {
    id: string;
    name: string;
    version: string;
    minAppVersion: string;
    description: string;
    author: string;
    authorUrl?: string;
    isDesktopOnly?: boolean;
  }

  export interface Command {
    id: string;
    name: string;
    editorCallback?: (editor: Editor) => void;
    callback?: () => void;
  }

  export interface Editor {
    getCursor(): EditorPosition;
    setCursor(pos: EditorPosition): void;
    lineCount(): number;
    getLine(line: number): string;
    replaceRange(replacement: string, from: EditorPosition, to: EditorPosition): void;
    getValue(): string;
    setValue(content: string): void;
  }

  export interface EditorPosition {
    line: number;
    ch: number;
  }

  export interface MarkdownPostProcessorContext {
    getSectionInfo(el: HTMLElement): any;
  }

  export interface EventRef {
    // 事件引用接口
  }

  export abstract class PluginSettingTab {
    containerEl: HTMLElement;
    app: App;
    plugin: Plugin;
    
    constructor(app: App, plugin: Plugin);
    abstract display(): void;
  }

  export class Setting {
    settingEl: HTMLElement;
    
    constructor(containerEl: HTMLElement);
    setName(name: string): this;
    setDesc(desc: string): this;
    addSlider(callback: (slider: SliderComponent) => SliderComponent): this;
    addToggle(callback: (toggle: ToggleComponent) => ToggleComponent): this;
    addButton(callback: (button: ButtonComponent) => ButtonComponent): this;
    addColorPicker(callback: (colorPicker: ColorComponent) => ColorComponent): this;
  }

  export interface SliderComponent {
    setLimits(min: number, max: number, step: number): this;
    setValue(value: number): this;
    setDynamicTooltip(): this;
    onChange(callback: (value: number) => any): this;
  }

  export interface ToggleComponent {
    setValue(value: boolean): this;
    onChange(callback: (value: boolean) => any): this;
  }
  
  export interface ButtonComponent {
    setButtonText(text: string): this;
    setCta(): this;
    onClick(callback: () => any): this;
  }
  
  export interface ColorComponent {
    setValue(value: string): this;
    onChange(callback: (value: string) => any): this;
  }
}

// 扩展HTMLElement接口以支持Obsidian特定方法
declare global {
  interface HTMLElement {
    empty(): void;
    createEl<K extends keyof HTMLElementTagNameMap>(
      tag: K, 
      attrs?: { 
        text?: string; 
        cls?: string | string[];
        attr?: Record<string, string>;
      }
    ): HTMLElementTagNameMap[K];
  }
}

// CodeMirror模块声明
declare module 'codemirror' {
  export function defineMode(name: string, factory: (config: any) => any): void;
  export function getMode(config: any, mode: string): any;
  export function startState(mode: any): any;
  export function copyState(mode: any, state: any): any;
}

declare module 'codemirror/mode/clike/clike' {
  // C-like模式声明
}