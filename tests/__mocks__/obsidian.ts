// Mock Obsidian API
export class Plugin {
  app: any;
  manifest: any;
  
  constructor(app: any, manifest: any) {
    this.app = app;
    this.manifest = manifest;
  }
  
  async onload() {}
  onunload() {}
  registerEvent(ref: any) {}
  registerMarkdownCodeBlockProcessor(language: string, processor: Function) {}
  addCommand(command: any) {}
  addSettingTab(tab: any) {}
  async loadData() { return {}; }
  async saveData(data: any) {}
}

export class PluginSettingTab {
  containerEl: HTMLElement;
  app: any;
  plugin: any;
  
  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }
  
  display() {}
}

export class Setting {
  settingEl: HTMLElement;
  
  constructor(containerEl: HTMLElement) {
    this.settingEl = document.createElement('div');
    containerEl.appendChild(this.settingEl);
  }
  
  setName(name: string) { return this; }
  setDesc(desc: string) { return this; }
  addSlider(callback: Function) { return this; }
  addToggle(callback: Function) { return this; }
}

export class MarkdownView {
  editor: any;
  constructor() {
    this.editor = {};
  }
}

export interface App {}
export interface Editor {}
export interface EditorPosition {}
export interface MarkdownPostProcessorContext {}