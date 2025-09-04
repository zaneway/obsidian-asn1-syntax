// Jest DOM 扩展
import '@testing-library/jest-dom';

// 模拟 Obsidian API
global.mockObsidianAPI = {
  Plugin: class MockPlugin {
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
  },
  
  PluginSettingTab: class MockPluginSettingTab {
    containerEl: HTMLElement;
    app: any;
    plugin: any;
    
    constructor(app: any, plugin: any) {
      this.app = app;
      this.plugin = plugin;
      this.containerEl = document.createElement('div');
    }
    
    display() {}
  },
  
  Setting: class MockSetting {
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
};

// 设置全局变量
(global as any).Plugin = global.mockObsidianAPI.Plugin;
(global as any).PluginSettingTab = global.mockObsidianAPI.PluginSettingTab;
(global as any).Setting = global.mockObsidianAPI.Setting;

// 扩展 HTMLElement 以支持 Obsidian 特定方法（简化版）
(HTMLElement.prototype as any).empty = function() {
  this.innerHTML = '';
};

(HTMLElement.prototype as any).createEl = function(tag: string, attrs?: any) {
  const el = document.createElement(tag);
  if (attrs) {
    if (attrs.text) el.textContent = attrs.text;
    if (attrs.cls) {
      if (Array.isArray(attrs.cls)) {
        el.className = attrs.cls.join(' ');
      } else {
        el.className = attrs.cls;
      }
    }
    if (attrs.attr) {
      for (const [key, value] of Object.entries(attrs.attr)) {
        el.setAttribute(key, value as string);
      }
    }
  }
  this.appendChild(el);
  return el;
};