import { Plugin, MarkdownView, PluginSettingTab, App, Setting, Editor, EditorPosition, MarkdownPostProcessorContext } from 'obsidian';
import * as CodeMirror from 'codemirror';
import 'codemirror/mode/clike/clike';

// 定义插件设置接口
interface ASN1PluginSettings {
	indentSize: number;
	formatOnSave: boolean;
}

// 默认设置
const DEFAULT_SETTINGS: ASN1PluginSettings = {
	indentSize: 2,
	formatOnSave: true
};

export default class ASN1Plugin extends Plugin {
	settings: ASN1PluginSettings;

	async onload() {
		console.log('Loading ASN.1 plugin');

		// 加载设置
		await this.loadSettings();

		// 注册ASN.1语法高亮
		this.registerASN1Mode();

		// 注册代码块语言
		this.registerMarkdownCodeBlockProcessor('asn1', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
			const pre = document.createElement('pre');
			const code = document.createElement('code');
			code.className = 'language-asn1';
			code.textContent = source;
			pre.appendChild(code);
			el.appendChild(pre);
			
			// 应用语法高亮
			this.highlightASN1(code);
		});

		// 添加格式化命令
		this.addCommand({
			id: 'format-asn1',
			name: 'Format ASN.1',
			editorCallback: (editor: Editor) => {
				this.formatASN1(editor);
			}
		});

		// 添加设置选项卡
		this.addSettingTab(new ASN1SettingTab(this.app, this));

		// 如果启用了保存时格式化，注册事件
		if (this.settings.formatOnSave) {
			this.registerEvent(
				this.app.workspace.on('editor-change', (editor: Editor) => {
					// 简化处理，当内容变化时检查是否需要格式化
					if (this.isASN1CodeBlock(editor)) {
						// 可以在这里添加延迟格式化逻辑
					}
				})
			);
		}
	}

	// 检查当前编辑器是否在ASN.1代码块内 - 增强版本
	isASN1CodeBlock(editor: Editor): boolean {
		try {
			const cursor = editor.getCursor();
			const lineCount = editor.lineCount();
			
			if (!cursor || lineCount === 0) {
				return false;
			}
			
			// 向上查找代码块开始
			let startLine = cursor.line;
			let foundStart = false;
			
			while (startLine >= 0) {
				try {
					const line = editor.getLine(startLine);
					if (line && line.trim().startsWith('```asn1')) {
						foundStart = true;
						break;
					}
					// 如果遇到其他代码块开始，说明不在asn1块内
					if (line && line.trim().startsWith('```') && !line.trim().startsWith('```asn1')) {
						return false;
					}
				} catch (error) {
					console.warn('Error reading line', startLine, ':', error);
					return false;
				}
				startLine--;
			}
			
			if (!foundStart) {
				return false;
			}
			
			// 向下查找代码块结束
			let endLine = cursor.line;
			let foundEnd = false;
			
			while (endLine < lineCount) {
				try {
					const line = editor.getLine(endLine);
					if (line && line.trim() === '```' && endLine > startLine) {
						foundEnd = true;
						break;
					}
				} catch (error) {
					console.warn('Error reading line', endLine, ':', error);
					return false;
				}
				endLine++;
			}
			
			// 确认光标在代码块内
			return foundEnd && cursor.line > startLine && cursor.line < endLine;
		} catch (error) {
			console.error('Error in isASN1CodeBlock:', error);
			return false;
		}
	}

	// 注册ASN.1语法高亮模式
	registerASN1Mode() {
		// 使用CodeMirror的C-like模式作为基础，并扩展ASN.1特定语法
		CodeMirror.defineMode('asn1', function(config: any) {
			// 扩展C-like模式
			const clikeMode = CodeMirror.getMode(config, 'text/x-csrc');
			
			// ASN.1关键字 - 完整列表
			const keywords = [
				// 基本类型
				'BOOLEAN', 'INTEGER', 'BIT', 'OCTET', 'NULL', 'OBJECT', 'REAL',
				'ENUMERATED', 'EMBEDDED', 'UTF8String', 'RELATIVE-OID',
				
				// 字符串类型
				'NumericString', 'PrintableString', 'TeletexString', 'T61String',
				'VideotexString', 'IA5String', 'GraphicString', 'VisibleString',
				'GeneralString', 'UniversalString', 'BMPString',
				
				// 时间类型
				'UTCTime', 'GeneralizedTime',
				
				// 构造类型
				'SEQUENCE', 'SET', 'CHOICE', 'STRING',
				
				// 标记
				'UNIVERSAL', 'APPLICATION', 'PRIVATE', 'CONTEXT',
				'EXPLICIT', 'IMPLICIT', 'AUTOMATIC', 'TAGS',
				
				// 模块定义
				'DEFINITIONS', 'BEGIN', 'END', 'EXPORTS', 'IMPORTS', 'FROM',
				
				// 约束
				'SIZE', 'WITH', 'COMPONENT', 'COMPONENTS', 'PRESENT', 'ABSENT',
				'OPTIONAL', 'DEFAULT', 'INCLUDES', 'PATTERN',
				
				// 集合操作
				'UNION', 'INTERSECTION', 'EXCEPT', 'ALL',
				
				// 值
				'TRUE', 'FALSE', 'PLUS-INFINITY', 'MINUS-INFINITY',
				'MIN', 'MAX',
				
				// 高级概念
				'CLASS', 'TYPE-IDENTIFIER', 'ABSTRACT-SYNTAX', 'INSTANCE',
				'SYNTAX', 'UNIQUE', 'CONSTRAINED', 'CHARACTER',
				'PDV', 'EXTERNAL', 'BY', 'OF', 'IDENTIFIER'
			];
			
			// 创建关键字查找表
			const keywordsMap: {[key: string]: boolean} = {};
			for (const keyword of keywords) {
				keywordsMap[keyword] = true;
			}
			
			// 扩展token处理
			return {
				startState: function() {
					return {
						baseState: CodeMirror.startState(clikeMode),
						inComment: false
					};
				},
				copyState: function(state: any) {
					return {
						baseState: CodeMirror.copyState(clikeMode, state.baseState),
						inComment: state.inComment
					};
				},
				token: function(stream: any, state: any) {
					// 处理注释
					if (stream.match('--')) {
						stream.skipToEnd();
						return 'comment';
					}
					
					// 处理多行注释
					if (state.inComment) {
						if (stream.match('*-')) {
							state.inComment = false;
							return 'comment';
						}
						stream.next();
						return 'comment';
					}
					
					if (stream.match('-*')) {
						state.inComment = true;
						return 'comment';
					}
					
					// 处理字符串
					if (stream.match('"')) {
						while (!stream.eol()) {
							if (stream.next() === '"') {
								break;
							}
						}
						return 'string';
					}
					
					// 处理关键字
					if (stream.match(/^[A-Za-z][A-Za-z0-9-]*/)) {
						const word = stream.current().toUpperCase();
						if (keywordsMap[word]) {
							return 'keyword';
						}
						return 'variable';
					}
					
					// 处理数字
					if (stream.match(/^\d+(\.\d+)?/)) {
						return 'number';
					}
					
					// 处理特殊字符
					if (stream.match(/^[:{}\[\]().,;]/)) {
						return 'punctuation';
					}
					
					// 处理其他字符
					stream.next();
					return null;
				}
			};
		});
	}

	// 应用ASN.1语法高亮 - 改进版本，增强错误处理
	highlightASN1(codeElement: HTMLElement) {
		try {
			if (!codeElement) {
				console.warn('Code element is null or undefined');
				return;
			}
			
			const code = codeElement.textContent || '';
			
			if (!code.trim()) {
				console.warn('No code content to highlight');
				return;
			}
			
			// 关键字列表 - 与语法模式保持一致
			const keywords = [
				// 基本类型
				'BOOLEAN', 'INTEGER', 'BIT', 'OCTET', 'NULL', 'OBJECT', 'REAL',
				'ENUMERATED', 'EMBEDDED', 'UTF8String', 'RELATIVE-OID',
				
				// 字符串类型
				'NumericString', 'PrintableString', 'TeletexString', 'T61String',
				'VideotexString', 'IA5String', 'GraphicString', 'VisibleString',
				'GeneralString', 'UniversalString', 'BMPString',
				
				// 时间类型
				'UTCTime', 'GeneralizedTime',
				
				// 构造类型
				'SEQUENCE', 'SET', 'CHOICE', 'STRING',
				
				// 标记
				'UNIVERSAL', 'APPLICATION', 'PRIVATE', 'CONTEXT',
				'EXPLICIT', 'IMPLICIT', 'AUTOMATIC', 'TAGS',
				
				// 模块定义
				'DEFINITIONS', 'BEGIN', 'END', 'EXPORTS', 'IMPORTS', 'FROM',
				
				// 约束
				'SIZE', 'WITH', 'COMPONENT', 'COMPONENTS', 'PRESENT', 'ABSENT',
				'OPTIONAL', 'DEFAULT', 'INCLUDES', 'PATTERN',
				
				// 集合操作
				'UNION', 'INTERSECTION', 'EXCEPT', 'ALL',
				
				// 值
				'TRUE', 'FALSE', 'PLUS-INFINITY', 'MINUS-INFINITY',
				'MIN', 'MAX',
				
				// 高级概念
				'CLASS', 'TYPE-IDENTIFIER', 'ABSTRACT-SYNTAX', 'INSTANCE',
				'SYNTAX', 'UNIQUE', 'CONSTRAINED', 'CHARACTER',
				'PDV', 'EXTERNAL', 'BY', 'OF', 'IDENTIFIER'
			];
			
			// 转义HTML字符
			function escapeHtml(unsafe: string): string {
				try {
					return unsafe
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/"/g, "&quot;")
						.replace(/'/g, "&#039;");
				} catch (error) {
					console.warn('Error escaping HTML:', error);
					return unsafe;
				}
			}
			
			// 先转义HTML字符
			let highlightedCode = escapeHtml(code);
			
			try {
				// 高亮多行注释 (-* ... *-)
				highlightedCode = highlightedCode.replace(/-\*[\s\S]*?\*-/g, '<span class="asn1-comment">$&</span>');
				
				// 高亮单行注释 (--)
				highlightedCode = highlightedCode.replace(/--.*$/gm, '<span class="asn1-comment">$&</span>');
				
				// 高亮字符串 (双引号)
				highlightedCode = highlightedCode.replace(/"(?:[^"\\\\]|\\\\.)*"/g, '<span class="asn1-string">$&</span>');
				
				// 高亮数字 (整数和小数)
				highlightedCode = highlightedCode.replace(/\b\d+(?:\.\d+)?\b/g, '<span class="asn1-number">$&</span>');
				
				// 高亮对象标识符 (如 {1 2 3 4})
				highlightedCode = highlightedCode.replace(/\{[\d\s]+\}/g, '<span class="asn1-oid">$&</span>');
				
				// 高亮标签 (如 [0], [1] EXPLICIT, [APPLICATION 5])
				highlightedCode = highlightedCode.replace(/\[(?:UNIVERSAL|APPLICATION|PRIVATE|CONTEXT)?\s*\d+\](?:\s+(?:IMPLICIT|EXPLICIT))?/g, '<span class="asn1-tag">$&</span>');
				
				// 高亮类型定义符号 (::=)
				highlightedCode = highlightedCode.replace(/::\s*=/g, '<span class="asn1-operator">$&</span>');
				
				// 高亮范围操作符 (...)
				highlightedCode = highlightedCode.replace(/\.\.\./g, '<span class="asn1-operator">$&</span>');
				
				// 高亮关键字 (必须在其他高亮之后执行，避免覆盖已高亮的内容)
				for (const keyword of keywords) {
					try {
						// 使用更精确的正则表达式，避免在已高亮的span标签内匹配
						const escapedKeyword = keyword.replace(/[-\[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
						const regex = new RegExp(
							`(?<!<[^>]*>)\\b${escapedKeyword}\\b(?![^<]*</span>)`,
							'gi'
						);
						highlightedCode = highlightedCode.replace(regex, '<span class="asn1-keyword">$&</span>');
					} catch (error) {
						console.warn(`Error highlighting keyword "${keyword}":`, error);
					}
				}
				
				// 设置高亮后的HTML
				codeElement.innerHTML = highlightedCode;
			} catch (error) {
				console.error('Error during syntax highlighting:', error);
				// 如果高亮失败，至少保持原始文本
				codeElement.textContent = code;
			}
		} catch (error) {
			console.error('Error in highlightASN1:', error);
		}
	}

	// 格式化ASN.1代码 - 增强错误处理
	formatASN1(editor: Editor) {
		try {
			const cursor = editor.getCursor();
			const lineCount = editor.lineCount();
			
			if (!cursor || lineCount === 0) {
				console.warn('Editor is empty or cursor not available');
				return;
			}
			
			// 查找ASN.1代码块
			let startLine = cursor.line;
			let endLine = cursor.line;
			let foundStart = false;
			
			// 向上查找代码块开始
			while (startLine >= 0) {
				try {
					const line = editor.getLine(startLine);
					if (line && line.trim().startsWith('```asn1')) {
						foundStart = true;
						break;
					}
				} catch (error) {
					console.warn('Error reading line', startLine, ':', error);
					break;
				}
				startLine--;
			}
			
			if (!foundStart) {
				console.warn('ASN.1 code block start not found');
				return;
			}
			
			// 向下查找代码块结束
			let foundEnd = false;
			while (endLine < lineCount) {
				try {
					const line = editor.getLine(endLine);
					if (line && line.trim() === '```' && endLine > startLine) {
						foundEnd = true;
						break;
					}
				} catch (error) {
					console.warn('Error reading line', endLine, ':', error);
					break;
				}
				endLine++;
			}
			
			if (!foundEnd) {
				console.warn('ASN.1 code block end not found');
				return;
			}
			
			// 提取代码块内容
			const codeLines = [];
			for (let i = startLine + 1; i < endLine; i++) {
				try {
					codeLines.push(editor.getLine(i));
				} catch (error) {
					console.warn('Error reading line', i, ':', error);
					codeLines.push(''); // 添加空行以保持行号对齐
				}
			}
			
			if (codeLines.length === 0) {
				console.warn('No content to format');
				return;
			}
			
			// 格式化代码
			const originalCode = codeLines.join('\n');
			const formattedCode = this.formatASN1Code(originalCode);
			
			if (formattedCode === originalCode) {
				console.log('Code is already formatted');
				return;
			}
			
			// 替换代码块内容
			try {
				editor.replaceRange(
					formattedCode,
					{ line: startLine + 1, ch: 0 },
					{ line: endLine, ch: 0 }
				);
				console.log('Code formatted successfully');
			} catch (error) {
				console.error('Error replacing code content:', error);
			}
		} catch (error) {
			console.error('Error in formatASN1:', error);
		}
	}

	// ASN.1代码格式化算法 - 改进版本
	formatASN1Code(code: string): string {
		const lines = code.split('\n');
		const formattedLines = [];
		let indentLevel = 0;
		const indentSize = this.settings.indentSize;
		let inComment = false;
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const trimmedLine = line.trim();
			
			// 跳过空行，但保留它们
			if (trimmedLine === '') {
				formattedLines.push('');
				continue;
			}
			
			// 检查是否在多行注释内
			if (trimmedLine.startsWith('-*')) {
				inComment = true;
			}
			if (trimmedLine.endsWith('*-')) {
				inComment = false;
				// 注释行保持原有缩进
				formattedLines.push(line);
				continue;
			}
			if (inComment || trimmedLine.startsWith('--')) {
				// 注释行保持原有缩进
				formattedLines.push(line);
				continue;
			}
			
			// 处理减少缩进的情况 - 在添加缩进之前
			const isClosingElement = (
				trimmedLine === '}' || 
				trimmedLine === ']' || 
				trimmedLine === ')' ||
				trimmedLine.endsWith('}') ||
				trimmedLine.endsWith('],') ||
				trimmedLine.endsWith('},' ) ||
				trimmedLine === 'END' ||
				trimmedLine.startsWith('END ')
			);
			
			if (isClosingElement) {
				indentLevel = Math.max(0, indentLevel - 1);
			}
			
			// 处理标签的特殊情况 (如 [0], [APPLICATION 1])
			const isTaggedElement = /^\s*\[\s*(?:UNIVERSAL|APPLICATION|PRIVATE|CONTEXT)?\s*\d+\s*\]/i.test(trimmedLine);
			
			// 生成缩进
			const indent = ' '.repeat(indentLevel * indentSize);
			
			// 对于标签元素，可能需要特殊处理
			if (isTaggedElement && !trimmedLine.includes('::=')) {
				// 标签元素通常与上一行对齐
				formattedLines.push(indent + trimmedLine);
			} else {
				formattedLines.push(indent + trimmedLine);
			}
			
			// 处理增加缩进的情况 - 在添加缩进之后
			const isOpeningElement = (
				trimmedLine.endsWith('{') || 
				trimmedLine.endsWith('[') || 
				trimmedLine.endsWith('(') ||
				trimmedLine === 'BEGIN' ||
				trimmedLine.endsWith('BEGIN') ||
				// 处理 SEQUENCE OF, SET OF 等情况
				(/\b(?:SEQUENCE|SET|CHOICE)\b.*\{$/.test(trimmedLine)) ||
				// 处理类型定义后跟 { 的情况
				(/::=\s*\{$/.test(trimmedLine))
			);
			
			if (isOpeningElement) {
				indentLevel++;
			}
			
			// 处理特殊的ASN.1结构
			if (/\bCOMPONENTS\s+OF\b/i.test(trimmedLine)) {
				// COMPONENTS OF 可能需要特殊缩进处理
			}
			
			// 处理枚举值的对齐
			if (trimmedLine.match(/^\w+\(\d+\)[\s,]*$/)) {
				// 枚举值，可能需要额外的缩进对齐
			}
		}
		
		// 后处理：处理一些特殊的格式化需求
		return this.postProcessFormatting(formattedLines.join('\n'));
	}
	
	// 后处理格式化
	private postProcessFormatting(code: string): string {
		let processed = code;
		
		// 确保操作符周围有适当的空格
		processed = processed.replace(/::=/g, ' ::= ');
		processed = processed.replace(/\s+::=\s+/g, ' ::= ');
		
		// 处理逗号后的空格
		processed = processed.replace(/,(\S)/g, ', $1');
		
		// 处理大括号、方括号、圆括号周围的空格
		processed = processed.replace(/\{\s+/g, '{ ');
		processed = processed.replace(/\s+\}/g, ' }');
		processed = processed.replace(/\[\s+/g, '[');
		processed = processed.replace(/\s+\]/g, ']');
		
		// 移除多余的空行
		processed = processed.replace(/\n\s*\n\s*\n/g, '\n\n');
		
		return processed;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class ASN1SettingTab extends PluginSettingTab {
	plugin: ASN1Plugin;

	constructor(app: App, plugin: ASN1Plugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		// 清空容器
		(containerEl as any).empty();

		// 创建标题
		(containerEl as any).createEl('h2', {text: 'ASN.1 Syntax Settings'});

		new Setting(containerEl)
			.setName('Indent Size')
			.setDesc('Number of spaces to use for each indentation level')
			.addSlider((slider: any) => slider
				.setLimits(1, 8, 1)
				.setValue(this.plugin.settings.indentSize)
				.setDynamicTooltip()
				.onChange(async (value: number) => {
					this.plugin.settings.indentSize = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Format on Save')
			.setDesc('Automatically format ASN.1 code blocks when saving')
			.addToggle((toggle: any) => toggle
				.setValue(this.plugin.settings.formatOnSave)
				.onChange(async (value: boolean) => {
					this.plugin.settings.formatOnSave = value;
					await this.plugin.saveSettings();
				}));
	}
}