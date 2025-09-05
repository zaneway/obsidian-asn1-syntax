import { Plugin, MarkdownView, PluginSettingTab, App, Setting, Editor, EditorPosition, MarkdownPostProcessorContext } from 'obsidian';
// import * as CodeMirror from 'codemirror';
// import 'codemirror/mode/clike/clike';

// ASN.1令牌接口
interface ASN1Token {
	type: 'module-definition' | 'begin' | 'end' | 'type-name' | 'type-definition' | 'opening-brace' | 'field' | 'closing-brace' | 'comment' | 'other';
	content: string;
	level: number;
}

// ASN.1结构节点接口
interface ASN1StructureNode {
	type: 'root' | 'module' | 'begin' | 'end' | 'type-definition' | 'field' | 'comment' | 'other';
	name: string;
	content: string;
	children: ASN1StructureNode[];
	level: number;
	structureType?: 'SEQUENCE' | 'SET' | 'CHOICE' | 'ENUMERATED' | 'PRIMITIVE';
	isInline?: boolean;  // 是否为单行定义
	fields?: string[];   // 字段列表
}

// 定义插件设置接口
interface ASN1PluginSettings {
	indentSize: number;
	formatOnSave: boolean;
	maxLineLength: number;
	autoWrapLongLines: boolean;
	// 新增：增强自动格式化选项
	autoFormatOnExit: boolean; // 离开代码块时自动格式化
	autoFormatOnEnter: boolean; // 按Enter键时自动格式化
	// 颜色设置
	colors: {
		keyword: string;
		string: string;
		comment: string;
		number: string;
		punctuation: string;
		variable: string;
		oid: string;
		tag: string;
		operator: string;
	};
	darkColors: {
		keyword: string;
		string: string;
		comment: string;
		number: string;
		punctuation: string;
		variable: string;
		oid: string;
		tag: string;
		operator: string;
	};
}

// 默认设置
const DEFAULT_SETTINGS: ASN1PluginSettings = {
	indentSize: 2,
	formatOnSave: true,
	maxLineLength: 80,
	autoWrapLongLines: true,
	// 新增默认设置
	autoFormatOnExit: true,
	autoFormatOnEnter: true,
	// 默认亮色主题颜色
	colors: {
		keyword: '#07a',
		string: '#690',
		comment: '#999',
		number: '#905',
		punctuation: '#999',
		variable: '#DD4A68',
		oid: '#8E44AD',
		tag: '#E67E22',
		operator: '#2C3E50'
	},
	// 默认暗色主题颜色
	darkColors: {
		keyword: '#c678dd',
		string: '#98c379',
		comment: '#5c6370',
		number: '#d19a66',
		punctuation: '#abb2bf',
		variable: '#e06c75',
		oid: '#BB86FC',
		tag: '#F39C12',
		operator: '#56B6C2'
	}
};

export default class ASN1Plugin extends Plugin {
	settings: ASN1PluginSettings;
	private formattingInProgress: boolean = false;

	async onload() {
		try {
			console.log('Loading ASN.1 plugin');

			// 加载设置
			await this.loadSettings();

			// 注册ASN.1语法高亮
			this.registerASN1Mode();

			// 注册代码块语言
			this.registerMarkdownCodeBlockProcessor('asn1', (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
				try {
					const pre = document.createElement('pre');
					const code = document.createElement('code');
					code.className = 'language-asn1';
					code.textContent = source;
					pre.appendChild(code);
					el.appendChild(pre);
					
					// 应用语法高亮
					this.highlightASN1(code);
				} catch (error) {
					console.error('Error in ASN.1 code block processor:', error);
				}
			});

			// 添加格式化命令
			this.addCommand({
				id: 'format-asn1',
				name: 'Format ASN.1',
				editorCallback: (editor: Editor) => {
					try {
						this.formatASN1(editor);
					} catch (error) {
						console.error('Error in format command:', error);
					}
				}
			});
			
			// 添加实时格式化命令
			this.addCommand({
				id: 'auto-format-asn1',
				name: 'Auto Format ASN.1 (Real-time)',
				editorCallback: (editor: Editor) => {
					try {
						this.toggleAutoFormatting(editor);
					} catch (error) {
						console.error('Error in auto format command:', error);
					}
				}
			});
			
			// 添加测试命令
			this.addCommand({
				id: 'test-asn1-auto-format',
				name: 'Test ASN.1 Auto Format (Current Block)',
				editorCallback: (editor: Editor) => {
					try {
						if (this.isASN1CodeBlock(editor)) {
							this.autoFormatCurrentBlock(editor);
							console.log('Auto format test executed');
						} else {
							console.log('Not in ASN.1 code block');
						}
					} catch (error) {
						console.error('Error in test command:', error);
					}
				}
			});

			// 添加设置选项卡
			this.addSettingTab(new ASN1SettingTab(this.app, this));
			
			// 初始化自定义颜色
			this.applyCustomColors();

			// 设置全局自动格式化功能 - 新的可靠实现
			this.setupGlobalAutoFormatting();

			console.log('ASN.1 plugin loaded successfully');
		} catch (error) {
			console.error('Error loading ASN.1 plugin:', error);
			throw error;
		}
	}

	// 设置自动格式化 - 增强版本，支持离开代码块和Enter键触发
	setupAutoFormatting(editor: Editor) {
		// 检查是否启用了任何自动格式化功能
		if (!this.settings.formatOnSave && !this.settings.autoFormatOnExit && !this.settings.autoFormatOnEnter) {
			return;
		}
		
		let lastASN1BlockState = false; // 跟踪是否在ASN.1代码块中
		let formatTimer: NodeJS.Timeout | null = null; // 格式化延时器
		
		// 使用Obsidian的编辑器事件系统
		const editorChange = this.app.workspace.on('editor-change', (changedEditor: Editor) => {
			if (this.formattingInProgress) {
				return;
			}
			console.log('Editor change detected');
			if (changedEditor === editor) {
				console.log('Change in target editor');
				
				// 清除之前的延时器
				if (formatTimer) {
					clearTimeout(formatTimer);
					formatTimer = null;
				}
				
				const currentlyInASN1Block = this.isASN1CodeBlock(changedEditor);
				
				// 检查是否刚离开ASN.1代码块
				if (this.settings.autoFormatOnExit && lastASN1BlockState && !currentlyInASN1Block) {
					console.log('Left ASN.1 code block, triggering format');
					formatTimer = setTimeout(() => {
						// 需要找到刚才编辑的代码块并格式化
						this.formatLastASN1Block(changedEditor);
					}, 300);
				}
				
				// 如果当前在ASN.1代码块中且启用了保存时格式化
				if (this.settings.formatOnSave && currentlyInASN1Block) {
					// 检查最后输入的字符
					const cursor = changedEditor.getCursor();
					if (cursor && cursor.ch > 0) {
						const currentLine = changedEditor.getLine(cursor.line);
						const lastChar = currentLine.charAt(cursor.ch - 1);
						console.log('Last character:', lastChar);
						
						// 在输入特定字符后触发格式化
						if (lastChar === '}' || lastChar === ';' || lastChar === ',' || lastChar === ')' || lastChar === ']') {
							console.log('Trigger character detected, scheduling format');
							formatTimer = setTimeout(() => {
								if (this.isASN1CodeBlock(changedEditor)) {
									this.autoFormatCurrentBlock(changedEditor);
								}
							}, 200);
						}
					}
				}
				
				// 更新状态
				lastASN1BlockState = currentlyInASN1Block;
			}
		});
		
		// 监听Enter键和光标移动
		const handleKeyDown = (event: KeyboardEvent) => {
			if (this.formattingInProgress) {
				return;
			}
			// 清除之前的延时器
			if (formatTimer) {
				clearTimeout(formatTimer);
				formatTimer = null;
			}
			
			// Enter键触发格式化
			if (this.settings.autoFormatOnEnter && event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.altKey) {
				console.log('Enter key pressed');
				formatTimer = setTimeout(() => {
					if (this.isASN1CodeBlock(editor)) {
						console.log('Formatting after Enter in ASN.1 block');
						this.autoFormatCurrentBlock(editor);
					}
				}, 200);
			}
			
			// 监听方向键，可能表示离开代码块
			if (this.settings.autoFormatOnExit && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
				formatTimer = setTimeout(() => {
					const currentlyInASN1Block = this.isASN1CodeBlock(editor);
					if (lastASN1BlockState && !currentlyInASN1Block) {
						console.log('Left ASN.1 code block via navigation, triggering format');
						this.formatLastASN1Block(editor);
					}
					lastASN1BlockState = currentlyInASN1Block;
				}, 500);
			}
		};
		
		// 监听鼠标点击事件，检测光标离开代码块
		const handleMouseClick = (event: MouseEvent) => {
			if (this.formattingInProgress) {
				return;
			}
			if (!this.settings.autoFormatOnExit) {
				return;
			}
			
			// 清除之前的延时器
			if (formatTimer) {
				clearTimeout(formatTimer);
				formatTimer = null;
			}
			
			formatTimer = setTimeout(() => {
				const currentlyInASN1Block = this.isASN1CodeBlock(editor);
				if (lastASN1BlockState && !currentlyInASN1Block) {
					console.log('Left ASN.1 code block via mouse click, triggering format');
					this.formatLastASN1Block(editor);
				}
				lastASN1BlockState = currentlyInASN1Block;
			}, 300);
		};
		
		// 尝试添加事件监听
		const editorElement = (editor as any).containerEl || (editor as any).cm?.getWrapperElement();
		if (editorElement) {
			editorElement.addEventListener('keydown', handleKeyDown);
			if (this.settings.autoFormatOnExit) {
				editorElement.addEventListener('click', handleMouseClick);
			}
			
			// 在插件卸载时移除事件监听
			this.register(() => {
				editorElement.removeEventListener('keydown', handleKeyDown);
				editorElement.removeEventListener('click', handleMouseClick);
				this.app.workspace.offref(editorChange);
				if (formatTimer) {
					clearTimeout(formatTimer);
				}
			});
		} else {
			// 如果无法获取编辑器元素，只注册workspace事件
			this.register(() => {
				this.app.workspace.offref(editorChange);
				if (formatTimer) {
					clearTimeout(formatTimer);
				}
			});
		}
		
		// 初始化状态
		lastASN1BlockState = this.isASN1CodeBlock(editor);
	}
	
	// 自动格式化当前代码块
	autoFormatCurrentBlock(editor: Editor) {
		try {
			console.log('autoFormatCurrentBlock called');
			if (this.isASN1CodeBlock(editor)) {
				console.log('In ASN.1 code block, formatting...');
				const cursor = editor.getCursor();
				const originalCursorLine = cursor.line;
				const originalCursorCh = cursor.ch;
				
				this.formattingInProgress = true;
				this.formatASN1(editor);
				this.formattingInProgress = false;
				
				// 尝试恢复光标位置
				try {
					// 获取新的行数，确保光标位置有效
					const newLineCount = editor.lineCount();
					const targetLine = Math.min(originalCursorLine, newLineCount - 1);
					const lineContent = editor.getLine(targetLine);
					const targetCh = Math.min(originalCursorCh, lineContent.length);
					
					editor.setCursor({ line: targetLine, ch: targetCh });
					console.log('Cursor position restored');
				} catch (error) {
					// 如果恢复光标失败，忽略错误
					console.warn('Could not restore cursor position:', error);
				}
			} else {
				console.log('Not in ASN.1 code block');
			}
		} catch (error) {
			console.error('Error in autoFormatCurrentBlock:', error);
			this.formattingInProgress = false;
		}
	}
	
	// 格式化最近编辑的ASN.1代码块
	formatLastASN1Block(editor: Editor) {
		try {
			console.log('formatLastASN1Block called');
			const cursor = editor.getCursor();
			const lineCount = editor.lineCount();
			
			if (!cursor || lineCount === 0) {
				return;
			}
			
			// 搜索附近的ASN.1代码块
			let searchStart = Math.max(0, cursor.line - 50); // 向上搜索50行
			let searchEnd = Math.min(lineCount - 1, cursor.line + 50); // 向下搜索50行
			
			for (let i = searchStart; i <= searchEnd; i++) {
				try {
					const line = editor.getLine(i);
					if (line && line.trim().startsWith('```asn1')) {
						// 找到ASN.1代码块开始，查找结束位置
						let endLine = i + 1;
						while (endLine < lineCount) {
							const endLineContent = editor.getLine(endLine);
							if (endLineContent && endLineContent.trim() === '```') {
								// 找到代码块，格式化它
								console.log(`Found ASN.1 block from line ${i} to ${endLine}, formatting...`);
								this.formatSpecificASN1Block(editor, i, endLine);
								return;
							}
							endLine++;
						}
					}
				} catch (error) {
					console.warn('Error reading line', i, ':', error);
				}
			}
			
			console.log('No ASN.1 block found near cursor position');
		} catch (error) {
			console.error('Error in formatLastASN1Block:', error);
		}
	}
	
	// 格式化指定的ASN.1代码块
	formatSpecificASN1Block(editor: Editor, startLine: number, endLine: number) {
		try {
			console.log(`Formatting ASN.1 block from line ${startLine} to ${endLine}`);
			
			// 提取代码块内容
			const codeLines = [];
			for (let i = startLine + 1; i < endLine; i++) {
				try {
					codeLines.push(editor.getLine(i));
				} catch (error) {
					console.warn('Error reading line', i, ':', error);
					codeLines.push('');
				}
			}
			
			if (codeLines.length === 0) {
				console.log('No content to format');
				return;
			}
			
			// 格式化代码
			const originalCode = codeLines.join('\n');
			console.log('Original code to format:', originalCode);
			
			const formattedCode = this.formatASN1Code(originalCode);
			console.log('Formatted code result:', formattedCode);
			
			if (formattedCode === originalCode) {
				console.log('Code is already formatted');
				return;
			}
			
			// 替换代码块内容
			const cursor = editor.getCursor();
			try {
				// 确保格式化结果以换行符结尾，避免影响``结束标记
				const finalFormattedCode = formattedCode.endsWith('\n') ? formattedCode : formattedCode + '\n';
				
				editor.replaceRange(
					finalFormattedCode,
					{ line: startLine + 1, ch: 0 },
					{ line: endLine, ch: 0 }
				);
				
				// 尝试恢复光标位置
				const newLineCount = editor.lineCount();
				const targetLine = Math.min(cursor.line, newLineCount - 1);
				const lineContent = editor.getLine(targetLine);
				const targetCh = Math.min(cursor.ch, lineContent ? lineContent.length : 0);
				
				editor.setCursor({ line: targetLine, ch: targetCh });
				console.log('Specific ASN.1 block formatted successfully');
			} catch (error) {
				console.error('Error replacing code content:', error);
			}
		} catch (error) {
			console.error('Error in formatSpecificASN1Block:', error);
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
	
	// 切换自动格式化功能
	toggleAutoFormatting(editor: Editor) {
		if (this.settings.formatOnSave) {
			this.settings.formatOnSave = false;
			console.log('Auto formatting disabled');
		} else {
			this.settings.formatOnSave = true;
			console.log('Auto formatting enabled');
		}
		this.saveSettings();
	}
	
	// 应用自定义颜色
	applyCustomColors() {
		// 移除旧的自定义样式
		const existingStyle = document.getElementById('asn1-custom-colors');
		if (existingStyle) {
			existingStyle.remove();
		}
		
		// 创建新的自定义样式
		const style = document.createElement('style');
		style.id = 'asn1-custom-colors';
		
		const lightColors = this.settings.colors;
		const darkColors = this.settings.darkColors;
		
		style.textContent = `
			/* ASN.1 自定义颜色 - 亮色主题 */
			.asn1-keyword { color: ${lightColors.keyword} !important; }
			.asn1-string { color: ${lightColors.string} !important; }
			.asn1-comment { color: ${lightColors.comment} !important; }
			.asn1-number { color: ${lightColors.number} !important; }
			.asn1-punctuation { color: ${lightColors.punctuation} !important; }
			.asn1-variable { color: ${lightColors.variable} !important; }
			.asn1-oid { color: ${lightColors.oid} !important; }
			.asn1-tag { color: ${lightColors.tag} !important; }
			.asn1-operator { color: ${lightColors.operator} !important; }
			
			/* ASN.1 自定义颜色 - 暗色主题 */
			.theme-dark .asn1-keyword { color: ${darkColors.keyword} !important; }
			.theme-dark .asn1-string { color: ${darkColors.string} !important; }
			.theme-dark .asn1-comment { color: ${darkColors.comment} !important; }
			.theme-dark .asn1-number { color: ${darkColors.number} !important; }
			.theme-dark .asn1-punctuation { color: ${darkColors.punctuation} !important; }
			.theme-dark .asn1-variable { color: ${darkColors.variable} !important; }
			.theme-dark .asn1-oid { color: ${darkColors.oid} !important; }
			.theme-dark .asn1-tag { color: ${darkColors.tag} !important; }
			.theme-dark .asn1-operator { color: ${darkColors.operator} !important; }
		`;
		
		document.head.appendChild(style);
	}
	
	onunload() {
		console.log('Unloading ASN.1 plugin');
		
		// 清理自定义颜色样式
		const existingStyle = document.getElementById('asn1-custom-colors');
		if (existingStyle) {
			existingStyle.remove();
		}
	}

	// 注册ASN.1语法高亮模式
	// 注册ASN.1语法高亮模式 - 暂时简化以避免CodeMirror问题
	registerASN1Mode() {
		try {
			console.log('ASN.1 syntax mode registered (simplified)');
			// TODO: 重新实现CodeMirror语法高亮
		} catch (error) {
			console.error('Error registering ASN.1 mode:', error);
		}
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
			console.log('formatASN1 started');
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
			console.log('Original code to format:', originalCode);
			
			const formattedCode = this.formatASN1Code(originalCode);
			console.log('Formatted code result:', formattedCode);
			
			if (formattedCode === originalCode) {
				console.log('Code is already formatted');
				return;
			}
			
			// 替换代码块内容
			try {
				// 确保格式化结果以换行符结尾，避免影响``结束标记
				const finalFormattedCode = formattedCode.endsWith('\n') ? formattedCode : formattedCode + '\n';
				
				editor.replaceRange(
					finalFormattedCode,
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

	// 格式化ASN.1代码的主要方法 - 简化重构版本
	formatASN1Code(code: string): string {
		console.log('🔧 Starting simplified ASN.1 format with code:', code);
		
		if (!code || !code.trim()) {
			return '';
		}
		
		try {
			// 直接使用正则表达式匹配和格式化
			return this.simpleFormatASN1(code);
		} catch (error) {
			console.error('❌ Error in ASN.1 formatting:', error);
			// 降级到简单格式化
			return this.fallbackFormat(code);
		}
	}

	// 简化的ASN.1格式化器 - 直接处理常见模式
	private simpleFormatASN1(code: string): string {
		let result = code.trim();
		
		// 1. 分离相邻的类型定义（在 } 和 TypeName ::= 之间插入换行）
		result = result.replace(/\}\s*(\w+\s*::=)/g, '}\n\n\n$1');
		
		// 2. 使用更稳健的方法处理嵌套大括号
		result = this.formatTypeDefinitionsWithNestedBraces(result);
		
		// 3. 清理多余的空行，确保类型定义之间正好2行空行
		result = this.cleanupSpacing(result);
		
		console.log('✨ Simple formatted result:', result);
		return result;
	}

	// 处理包含嵌套大括号的类型定义
	private formatTypeDefinitionsWithNestedBraces(code: string): string {
		const typeDefStartRegex = /(\w+\s*::=\s*(?:SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{)/g;
		let result = code;
		let match;
		
		// 从后往前处理，避免位置偏移问题
		const matches: Array<{start: number, end: number, prefix: string}> = [];
		
		while ((match = typeDefStartRegex.exec(code)) !== null) {
			const startPos = match.index;
			const prefix = match[1];
			
			// 找到匹配的闭合大括号
			const endPos = this.findMatchingBrace(code, startPos + prefix.length - 1);
			if (endPos !== -1) {
				matches.push({
					start: startPos,
					end: endPos,
					prefix: prefix
				});
			}
		}
		
		// 从后往前替换，避免位置偏移
		for (let i = matches.length - 1; i >= 0; i--) {
			const {start, end, prefix} = matches[i];
			const original = code.substring(start, end + 1);
			const formatted = this.formatSingleTypeDefinition(original, prefix);
			result = result.substring(0, start) + formatted + result.substring(end + 1);
		}
		
		return result;
	}

	// 找到匹配的闭合大括号位置
	private findMatchingBrace(code: string, openBracePos: number): number {
		let braceCount = 0;
		let inString = false;
		
		for (let i = openBracePos; i < code.length; i++) {
			const char = code[i];
			const prevChar = i > 0 ? code[i - 1] : '';
			
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				if (char === '{') {
					braceCount++;
				} else if (char === '}') {
					braceCount--;
					if (braceCount === 0) {
						return i;
					}
				}
			}
		}
		
		return -1; // 未找到匹配的闭合大括号
	}

	// 格式化单个类型定义
	private formatSingleTypeDefinition(original: string, prefix: string): string {
		// 提取大括号内的内容
		const openBracePos = original.indexOf('{');
		const closeBracePos = original.lastIndexOf('}');
		
		if (openBracePos === -1 || closeBracePos === -1) {
			return original;
		}
		
		const fieldContent = original.substring(openBracePos + 1, closeBracePos).trim();
		
		if (!fieldContent) {
			return `${prefix.trimEnd()}\n}`;
		}
		
		// 按顶层逗号分割字段
		const fieldSegments = this.splitTopLevelByComma(fieldContent);
		if (fieldSegments.length <= 1) {
			// 只有一个字段，保持原样但规范化空格
			const normalized = this.normalizeFieldContent(fieldContent);
			return `${prefix.trimEnd()}\n  ${normalized}\n}`;
		}
		
		// 多个字段，每行一个
		const indent = '  '; // 使用固定2空格缩进
		const lines: string[] = [];
		lines.push(prefix.trimEnd());
		
		for (let i = 0; i < fieldSegments.length; i++) {
			const field = this.normalizeFieldContent(fieldSegments[i]);
			const comma = i === fieldSegments.length - 1 ? '' : ',';
			lines.push(indent + field + comma);
		}
		
		lines.push('}');
		return lines.join('\n');
	}

	// 清理空行间距
	private cleanupSpacing(code: string): string {
		// 移除多余的空行，但保持类型定义之间的2行空行
		return code
			.replace(/\n{3,}/g, '\n\n\n')  // 3个以上换行变成3个
			.replace(/^\n+/, '')           // 移除开头的空行
			.replace(/\n+$/, '\n');        // 结尾只保留一个换行
	}

	// 保证相邻的类型定义之间正好间隔2个空行（3个换行）
	private ensureTwoBlankLinesBetweenTypeDefinitions(code: string): string {
		// 情况一：以闭合大括号结束的结构后紧跟下一个类型定义
		// 将 "}\n+<def>" 统一成 "}\n\n\n<def>"
		code = code.replace(/\}\n+(?=\s*\w+\s*::=)/g, '}\n\n\n');
		// 情况二：两个以关键字开头的定义直接相邻（极少见，但处理一下）
		code = code.replace(/(\w+\s*::=.*?)\n+(?=\s*\w+\s*::=)/gs, (_m, prev) => `${prev}\n\n\n`);
		return code;
	}

	// 兜底：将仍为单行的结构强制展开为多行字段
	private postExpandInlineStructures(code: string): string {
		// Type ::= (SEQUENCE|SET|CHOICE|ENUMERATED) { ... }
		const rx = /(\w+\s*::=\s*(?:SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{)([^}]*?)(\})/g;
		return code.replace(rx, (_m, prefix: string, inner: string, suffix: string) => {
			const parts = this.splitTopLevelByComma(inner);
			if (parts.length <= 1) return `${prefix}${inner}${suffix}`;
			const indentMatch = prefix.match(/^(\s*)/);
			const baseIndent = indentMatch ? indentMatch[1] : '';
			const fieldIndent = baseIndent + ' '.repeat(this.settings.indentSize);
			const lines: string[] = [];
			lines.push(prefix.trimEnd());
			for (let i = 0; i < parts.length; i++) {
				const seg = this.normalizeFieldContent(parts[i]);
				const comma = i === parts.length - 1 ? '' : ',';
				lines.push(fieldIndent + seg + comma);
			}
			lines.push(baseIndent + '}');
			return lines.join('\n');
		});
	}

	// 校验：原始文本中是否存在括号内为非空内容的结构块
	private containsNonEmptyStructureBlock(code: string): boolean {
		// 查找 "Name ::= (SEQUENCE|SET|CHOICE|ENUMERATED) { ... }"，且大括号内包含至少一行非空且不只是注释/大括号
		const re = /(\w+)\s*::=\s*(SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{([\s\S]*?)\}/g;
		let match: RegExpExecArray | null;
		while ((match = re.exec(code)) !== null) {
			const inner = match[3]
				.split(/\n/)
				.map(l => l.trim())
				.filter(l => l.length > 0 && l !== '{' && l !== '}' && !l.startsWith('--'));
			if (inner.length > 0) return true;
		}
		return false;
	}

	// 校验：格式化文本中是否出现空结构块（花括号内无有效内容）
	private containsEmptyStructureBlock(code: string): boolean {
		const re = /(\w+)\s*::=\s*(SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{([\s\S]*?)\}/g;
		let match: RegExpExecArray | null;
		while ((match = re.exec(code)) !== null) {
			const inner = match[3]
				.split(/\n/)
				.map(l => l.trim())
				.filter(l => l.length > 0 && l !== '{' && l !== '}' && !l.startsWith('--'));
			if (inner.length === 0) return true;
		}
		return false;
	}
	
	// 规范化ASN.1代码输入
	private normalizeASN1Code(code: string): string {
		// 先统一换行符和制表符转换
		let normalized = code
			.replace(/\r\n/g, '\n')  // 统一换行符
			.replace(/\r/g, '\n')
			.replace(/\t/g, ' ');     // 制表符转空格
		
		// 按行处理，避免破坏类型定义之间的分隔
		const lines = normalized.split('\n');
		const processedLines = lines.map(line => {
			return line
				.replace(/\s+/g, ' ')       // 行内多个空格合并为一个
				.replace(/\s*{\s*/g, ' { ')  // 规范化大括号前后空格
				.replace(/\s*}\s*/g, ' } ')
				.replace(/\s*,\s*/g, ', ')   // 规范化逗号后空格
				.replace(/\s*::=\s*/g, ' ::= ') // 规范化定义符号
				.trim();
		});
		
		// 重新组合，保持原有的空行结构
		return processedLines.join('\n').trim();
	}
	
	// 解析ASN.1结构
	private parseASN1Structure(code: string): ASN1StructureNode {
		const lines = code.split('\n').map(line => line.trim()).filter(line => line.length > 0);
		const rootNode: ASN1StructureNode = {
			type: 'root',
			name: '',
			content: '',
			children: [],
			level: 0
		};
		
		this.parseLines(lines, rootNode, 0);
		return rootNode;
	}
	
	// 递归解析代码行
	private parseLines(lines: string[], parentNode: ASN1StructureNode, startIndex: number): number {
		let i = startIndex;
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = lines.length * 10; // 设置最大迭代次数
		
		while (i < lines.length && safetyCounter < maxIterations) {
			safetyCounter++;
			const line = lines[i];
			console.log(`🔍 Parsing line ${i}: "${line}"`);
			
			// 1. 模块定义
			if (this.isModuleDefinition(line)) {
				const moduleNode = this.createModuleNode(line);
				parentNode.children.push(moduleNode);
				i++;
				continue;
			}
			
			// 2. BEGIN关键字
			if (line.trim() === 'BEGIN' || line.includes('BEGIN')) {
				const beginNode = this.createBeginNode();
				parentNode.children.push(beginNode);
				i++;
				continue;
			}
			
			// 3. END关键字
			if (line.trim() === 'END' || line.startsWith('END')) {
				const endNode = this.createEndNode(line);
				parentNode.children.push(endNode);
				i++;
				continue;
			}
			
			// 4. 类型定义（包括单行和多行）
			if (this.isTypeDefinition(line)) {
				const typeNode = this.parseTypeDefinition(line, lines, i);
				parentNode.children.push(typeNode.node);
				i = typeNode.nextIndex;
				continue;
			}
			
			// 5. 字段定义
			if (this.isFieldDefinition(line)) {
				const fieldNode = this.createFieldNode(line);
				parentNode.children.push(fieldNode);
				i++;
				continue;
			}
			
			// 6. 注释
			if (this.isComment(line)) {
				const commentNode = this.createCommentNode(line);
				parentNode.children.push(commentNode);
				i++;
				continue;
			}
			
			// 7. 独立的大括号
			if (line === '}') {
				// 结束当前结构
				break;
			}
			
			// 8. 其他内容
			const otherNode = this.createOtherNode(line);
			parentNode.children.push(otherNode);
			i++;
		}
		
		// 如果达到最大迭代次数，记录警告
		if (safetyCounter >= maxIterations) {
			console.warn('⚠️ Safety counter reached maximum iterations in parseLines, preventing infinite loop');
		}
		
		return i;
	}

	
	// 检查是否为单行结构定义（增强版）
	private isSingleLineStructure(line: string): boolean {
		const patterns = [
			/^\w+\s*::=\s*(SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{[^{}]+\}\s*$/,
			/^\w+\s*::=\s*(SEQUENCE|SET)\s+OF\s+\w+\s*$/,
			/^\w+\s*::=\s*\w+\s*\([^)]*\)\s*$/  // 带约束的定义
		];
		
		for (const pattern of patterns) {
			if (pattern.test(line.trim())) {
				console.log('✅ Detected single line structure:', line);
				return true;
			}
		}
		
		return false;
	}

		
		
	// 创建各种类型的节点
	private createModuleNode(line: string): ASN1StructureNode {
		const match = line.match(/(\w+)\s+DEFINITIONS\s+(.*?)\s*::=\s*BEGIN/);
		return {
			type: 'module',
			name: match ? match[1] : 'Unknown',
			content: line,
			children: [],
			level: 0
		};
	}
	
	private createBeginNode(): ASN1StructureNode {
		return {
			type: 'begin',
			name: 'BEGIN',
			content: 'BEGIN',
			children: [],
			level: 0
		};
	}
	
	private createEndNode(line: string): ASN1StructureNode {
		return {
			type: 'end',
			name: 'END',
			content: line,
			children: [],
			level: 0
		};
	}
	
	private createFieldNode(line: string): ASN1StructureNode {
		const cleaned = this.normalizeFieldContent(line);
		const parts = cleaned.split(/\s+/);
		return {
			type: 'field',
			name: parts[0] || '',
			content: cleaned,
			children: [],
			level: 0
		};
	}
	
	private createCommentNode(line: string): ASN1StructureNode {
		return {
			type: 'comment',
			name: 'comment',
			content: line,
			children: [],
			level: 0
		};
	}
	
	private createOtherNode(line: string): ASN1StructureNode {
		return {
			type: 'other',
			name: 'other',
			content: line,
			children: [],
			level: 0
		};
	}
	
	// 解析类型定义（增强版）
	private parseTypeDefinition(line: string, lines: string[], currentIndex: number): { node: ASN1StructureNode, nextIndex: number } {
		console.log('🔍 Parsing type definition:', line);
		
		// 提取类型名称
		const typeMatch = line.match(/(\w+)\s*::=\s*(.+)/);
		if (!typeMatch) {
			return {
				node: this.createOtherNode(line),
				nextIndex: currentIndex + 1
			};
		}
		
		const [, typeName, typeDefinition] = typeMatch;
		
		// 检查是否为单行完整定义
		if (this.isSingleLineStructure(line)) {
			return {
				node: this.parseSingleLineTypeDefinition(line, typeName, typeDefinition),
				nextIndex: currentIndex + 1
			};
		}
		
		// 检查是否为多行结构定义
		const structureMatch = typeDefinition.match(/(SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{(.*)/);
		if (structureMatch) {
			return this.parseMultiLineTypeDefinition(line, typeName, structureMatch[1] as any, lines, currentIndex);
		}
		
		// 基本类型定义
		return {
			node: {
				type: 'type-definition',
				name: typeName,
				content: line,
				children: [],
				level: 0,
				structureType: 'PRIMITIVE'
			},
			nextIndex: currentIndex + 1
		};
	}
	
	// 解析单行类型定义
	private parseSingleLineTypeDefinition(line: string, typeName: string, typeDefinition: string): ASN1StructureNode {
		const structureMatch = typeDefinition.match(/(SEQUENCE|SET|CHOICE|ENUMERATED)\s*\{([^}]+)\}/);
		if (!structureMatch) {
			return this.createOtherNode(line);
		}
		
		const [, structureType, fieldsStr] = structureMatch;
		const fields = this.parseInlineFields(fieldsStr);
		
		return {
			type: 'type-definition',
			name: typeName,
			content: line,
			children: [],
			level: 0,
			structureType: structureType as any,
			isInline: true,
			fields: fields
		};
	}
	
	// 解析多行类型定义
	private parseMultiLineTypeDefinition(
		openingLine: string, 
		typeName: string, 
		structureType: 'SEQUENCE' | 'SET' | 'CHOICE' | 'ENUMERATED',
		lines: string[], 
		currentIndex: number
	): { node: ASN1StructureNode, nextIndex: number } {
		const node: ASN1StructureNode = {
			type: 'type-definition',
			name: typeName,
			content: openingLine,
			children: [],
			level: 0,
			structureType: structureType,
			isInline: false
		};
		
		// 解析字段内容直到找到匹配的大括号
		let braceCount = 1;
		let i = currentIndex + 1;
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = lines.length * 5; // 设置最大迭代次数
		
		while (i < lines.length && braceCount > 0 && safetyCounter < maxIterations) {
			safetyCounter++;
			const line = lines[i].trim();
			if (!line) {
				i++;
				continue;
			}
			
			// 计算大括号
			const openBraces = (line.match(/\{/g) || []).length;
			const closeBraces = (line.match(/\}/g) || []).length;
			braceCount += openBraces;
			braceCount -= closeBraces;
			
			// 如果不是闭合大括号，且仍在结构内部，作为字段处理
			if (braceCount > 0 || (braceCount === 0 && closeBraces > 0)) {
				// 只有当行不是纯大括号时才作为字段处理
				if (line !== '}' && line !== '{') {
					let segments: string[] = [];
					if (openBraces > 0 && closeBraces > 0 && line.includes('{') && line.includes('}')) {
						// 同一行同时包含开闭大括号，取花括号内部内容作为字段串
						const start = line.indexOf('{');
						const end = line.lastIndexOf('}');
						const inner = start >= 0 && end > start ? line.substring(start + 1, end) : line;
						segments = this.splitTopLevelByComma(inner);
					} else {
						// 常规情况按顶层逗号拆分整行
						segments = this.splitTopLevelByComma(line);
					}
					for (const seg of segments) {
						if (seg.trim().length > 0) {
							const fieldNode = this.createFieldNode(seg);
							node.children.push(fieldNode);
						}
					}
				}
			}
			
			// 如果大括号已平衡且遇到闭合大括号，结束解析
			if (braceCount === 0 && closeBraces > 0) {
				i++;
				break;
			}
			
			i++;
		}
		
		// 如果达到最大迭代次数，记录警告
		if (safetyCounter >= maxIterations) {
			console.warn('⚠️ Safety counter reached maximum iterations in parseMultiLineTypeDefinition, preventing infinite loop');
		}
		
		return {
			node: node,
			nextIndex: i
		};
	}
	
	// 解析内联字段
	private parseInlineFields(fieldsStr: string): string[] {
		const fields: string[] = [];
		let current = '';
		let braceLevel = 0;
		let parenLevel = 0;
		let inString = false;
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = fieldsStr.length * 2; // 设置最大迭代次数
		
		for (let i = 0; i < fieldsStr.length && safetyCounter < maxIterations; i++, safetyCounter++) {
			const char = fieldsStr[i];
			
			if (char === '"' && (i === 0 || fieldsStr[i-1] !== '\\')) {
				inString = !inString;
			}
			
			if (!inString) {
				if (char === '{') braceLevel++;
				else if (char === '}') braceLevel--;
				else if (char === '(') parenLevel++;
				else if (char === ')') parenLevel--;
				else if (char === ',' && braceLevel === 0 && parenLevel === 0) {
					if (current.trim()) {
						fields.push(current.trim());
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段
		if (current.trim()) {
			fields.push(current.trim());
		}
		
		console.log('📋 Parsed inline fields:', fields);
		return fields;
	}
	
	// 格式化ASN.1结构
	private formatASN1Structure(rootNode: ASN1StructureNode): string {
		const lines: string[] = [];
		this.formatNode(rootNode, lines, 0);
		
		// 清理空行并确保合适的间距
		const cleanedLines = this.cleanupFormattedLines(lines);
		
		return cleanedLines.join('\n');
	}
	
	// 格式化单个节点
	private formatNode(node: ASN1StructureNode, lines: string[], level: number): void {
		// 添加安全计数器，防止无限递归
		if (level > 100) {
			console.warn('⚠️ Maximum recursion depth reached in formatNode, preventing infinite recursion');
			return;
		}
		
		const indent = ' '.repeat(level * this.settings.indentSize);
		
		switch (node.type) {
			case 'module':
				lines.push(node.content);
				break;
				
			case 'begin':
				lines.push(indent + node.content);
				lines.push(''); // 添加空行
				break;
				
			case 'end':
				lines.push(''); // END前添加空行
				lines.push(indent + node.content);
				break;
				
			case 'type-definition':
				if (node.isInline && node.fields) {
					// 处理单行定义，将其展开为多行
					this.formatInlineTypeDefinition(node, lines, level);
				} else {
					// 多行定义
					lines.push(indent + `${node.name} ::= ${node.structureType} {`);
					// 格式化子节点（字段）
					for (let i = 0; i < node.children.length; i++) {
						const child = node.children[i];
						const fieldIndent = ' '.repeat((level + 1) * this.settings.indentSize);
						const segments = this.splitTopLevelByComma(child.content);
						for (let s = 0; s < segments.length; s++) {
							const seg = this.normalizeFieldContent(segments[s]);
							const isLastOverall = (i === node.children.length - 1) && (s === segments.length - 1);
							const comma = isLastOverall ? '' : ',';
							lines.push(fieldIndent + seg + comma);
						}
					}
					lines.push(indent + '}');
				}
				// 在类型定义后添加空行（用于分隔多个类型定义）
				lines.push('');
				break;
				
			case 'comment':
				lines.push(indent + node.content);
				break;
				
			default:
				lines.push(indent + node.content);
				break;
		}
		
		// 递归格式化子节点：避免对类型定义节点的子节点重复输出
		if (node.type !== 'type-definition') {
			for (const child of node.children) {
				this.formatNode(child, lines, level + 1);
			}
		}
	}
	
	// 格式化内联类型定义
	private formatInlineTypeDefinition(node: ASN1StructureNode, lines: string[], level: number): void {
		const indent = ' '.repeat(level * this.settings.indentSize);
		const fieldIndent = ' '.repeat((level + 1) * this.settings.indentSize);
		
		// 添加类型定义开头
		lines.push(indent + `${node.name} ::= ${node.structureType} {`);
		
		// 添加字段
		if (node.fields) {
			for (let i = 0; i < node.fields.length; i++) {
				const field = this.normalizeFieldContent(node.fields[i]);
				const isLast = i === node.fields.length - 1;
				const comma = isLast ? '' : ',';
				lines.push(fieldIndent + field + comma);
			}
		}
		
		// 添加结束大括号
		lines.push(indent + '}');
		
		// 在内联类型定义后也添加空行（用于分隔多个类型定义）
		lines.push('');
	}
	
	// 清理格式化后的行
	private cleanupFormattedLines(lines: string[]): string[] {
		const cleaned: string[] = [];
		
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i];
			const prevLine = i > 0 ? lines[i - 1] : null;
			const nextLine = i < lines.length - 1 ? lines[i + 1] : null;
			
			// 跳过连续的第三个及以上空行，但保留双空行用于分隔
			if (line === '' && prevLine === '') {
				// 检查是否有第三个连续空行
				if (i > 1 && lines[i - 2] === '') {
					continue; // 跳过第三个及以上的空行
				}
			}
			
			// 跳过文件开头的空行
			if (i === 0 && line === '') {
				continue;
			}
			
			// 跳过文件结尾的多个空行（最后允许一个空行）
			if (i === lines.length - 1 && line === '' && prevLine === '') {
				continue;
			}
			
			cleaned.push(line);
		}
		
		return cleaned;
	}
	
	// 降级格式化方法（出错时使用）
	private fallbackFormat(code: string): string {
		console.log('🆘 Using fallback formatting...');
		
		// 简单的行处理
		const lines = code.split('\n');
		const result: string[] = [];
		let indentLevel = 0;
		const indentStr = ' '.repeat(this.settings.indentSize);
		
		for (const line of lines) {
			const trimmed = line.trim();
			if (!trimmed) continue;
			
			// 减少缩进（大括号闭合）
			if (trimmed === '}' || trimmed.startsWith('}')) {
				indentLevel = Math.max(0, indentLevel - 1);
			}
			
			// 添加行
			result.push(indentStr.repeat(indentLevel) + trimmed);
			
			// 增加缩进（大括号开启）
			if (trimmed.includes('{') && !trimmed.includes('}')) {
				indentLevel++;
			}
		}
		
		return result.join('\n');
	}
	
	// 智能分割字段 - 改进版本，更好地处理复杂字段
	private splitFields(fieldsStr: string): string[] {
		console.log('Splitting fields from:', fieldsStr);
		
		// 移除首尾空格和可能的闭合大括号
		fieldsStr = fieldsStr.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '').trim();
		
		const fields = [];
		let current = '';
		let braceCount = 0;
		let parenCount = 0;
		let bracketCount = 0;
		let inString = false;
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = fieldsStr.length * 2; // 设置最大迭代次数
		
		for (let i = 0; i < fieldsStr.length && safetyCounter < maxIterations; i++, safetyCounter++) {
			const char = fieldsStr[i];
			const prevChar = i > 0 ? fieldsStr[i - 1] : '';
			
			// 处理字符串
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				// 跟踪嵌套层级
				if (char === '{') braceCount++;
				else if (char === '}') braceCount--;
				else if (char === '(') parenCount++;
				else if (char === ')') parenCount--;
				else if (char === '[') bracketCount++;
				else if (char === ']') bracketCount--;
				
				// 在所有嵌套都关闭的情况下，逗号是字段分隔符
				else if (char === ',' && braceCount === 0 && parenCount === 0 && bracketCount === 0) {
					const fieldContent = current.trim();
					if (fieldContent) {
						fields.push(fieldContent + ',');
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段（不带逗号）
		const lastField = current.trim();
		if (lastField) {
			fields.push(lastField);
		}
		
		console.log('Split fields result:', fields);
		return fields;
	}
	
	// 强制分割字段 - 专门用于单行结构，修复缩进问题
	private forceSplitFields(fieldsStr: string): string[] {
		console.log('Force splitting fields:', fieldsStr);
		
		const fields = [];
		let current = '';
		let braceCount = 0;
		let parenCount = 0;
		let bracketCount = 0;
		let inString = false;
		
		// 清理输入字符串
		fieldsStr = fieldsStr.trim();
		
		const indentStr = ' '.repeat(this.settings.indentSize); // 使用用户设置的缩进
		
		for (let i = 0; i < fieldsStr.length; i++) {
			const char = fieldsStr[i];
			const prevChar = i > 0 ? fieldsStr[i - 1] : '';
			
			// 处理字符串
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				// 跟踪嵌套层级
				if (char === '{') braceCount++;
				else if (char === '}') braceCount--;
				else if (char === '(') parenCount++;
				else if (char === ')') parenCount--;
				else if (char === '[') bracketCount++;
				else if (char === ']') bracketCount--;
				
				// 在最外层遇到逗号时分割
				else if (char === ',' && braceCount === 0 && parenCount === 0 && bracketCount === 0) {
					const fieldContent = current.trim();
					if (fieldContent) {
						fields.push(indentStr + fieldContent + ','); // 使用设置的缩进
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段（不带逗号）
		const lastField = current.trim();
		if (lastField) {
			fields.push(indentStr + lastField); // 使用设置的缩进，不加逗号
		}
		
		console.log('Force split fields result:', fields);
		return fields;
	}
	
	// 强制分割枚举值 - 专门用于单行枚举，修复缩进问题
	private forceSplitEnumValues(enumValues: string): string[] {
		console.log('Force splitting enum values:', enumValues);
		
		const values = [];
		let current = '';
		let inString = false;
		
		// 清理输入字符串
		enumValues = enumValues.trim();
		
		const indentStr = ' '.repeat(this.settings.indentSize); // 使用用户设置的缩进
		
		for (let i = 0; i < enumValues.length; i++) {
			const char = enumValues[i];
			const prevChar = i > 0 ? enumValues[i - 1] : '';
			
			// 处理字符串
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				// 在最外层遇到逗号时分割
				if (char === ',' && !inString) {
					const valueContent = current.trim();
					if (valueContent) {
						values.push(indentStr + valueContent + ','); // 使用设置的缩进
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段（不带逗号）
		const lastValue = current.trim();
		if (lastValue) {
			values.push(indentStr + lastValue); // 使用设置的缩进，不加逗号
		}
		
		console.log('Force split enum values result:', values);
		return values;
	}
	
	// 包装长注释
	private wrapComment(comment: string, level: number, indentSize: number): string[] {
		const maxLength = this.settings.maxLineLength - (level * indentSize);
		const prefix = '--';
		const content = comment.substring(2).trim();
		
		if (content.length <= maxLength - prefix.length) {
			return [this.indent(comment, level, indentSize)];
		}
		
		const words = content.split(' ');
		const lines = [];
		let currentLine = prefix + ' ';
		
		for (const word of words) {
			if ((currentLine + word).length <= maxLength) {
				currentLine += word + ' ';
			} else {
				lines.push(this.indent(currentLine.trim(), level, indentSize));
				currentLine = prefix + ' ' + word + ' ';
			}
		}
		
		if (currentLine.trim() !== prefix) {
			lines.push(this.indent(currentLine.trim(), level, indentSize));
		}
		
		return lines;
	}
	
	private preProcessLongLines(code: string): string {
		let processed = code;
		
		console.log('Original input for preprocessing:', processed);
		
		// 1. 处理连续的类型定义（如：Type1 ::= ... Type2 ::= ...）
		processed = processed.replace(/(\}\s*)(\w+\s*::=)/g, '$1\n$2');
		
		// 2. 处理模块定义后跟类型定义的情况
		processed = processed.replace(/(BEGIN\s+)(\w+\s*::=)/g, '$1\n$2');
		
		// 3. 处理类型定义后跟END的情况
		processed = processed.replace(/(\}\s*)(END\b)/g, '$1\n$2');
		
		// 4. 特殊处理：将单行中包含完整结构的定义强制分解
		// 匹配形如：TypeName ::= SEQUENCE { field1 Type1, field2 Type2, ... }
		const singleLineStructureRegex = /(\w+\s*::=\s*(?:SEQUENCE|SET|CHOICE)\s*\{)([^}]+)(\})/g;
		processed = processed.replace(singleLineStructureRegex, (match, prefix, fields, suffix) => {
			console.log('Found single-line structure:', { prefix, fields, suffix });
			
			// 强制将字段分解为单独行
			const processedFields = this.forceSplitFields(fields);
			
			if (processedFields.length > 1) {
				// 如果有多个字段，将它们分解到不同行
				return prefix + '\n' + processedFields.join('\n') + '\n' + suffix;
			} else {
				// 只有一个字段或没有字段，保持原样
				return match;
			}
		});
		
		// 5. 处理枚举类型的单行定义
		const enumRegex = /(\w+\s*::=\s*ENUMERATED\s*\{)([^}]+)(\})/g;
		processed = processed.replace(enumRegex, (match, prefix, enumValues, suffix) => {
			console.log('Found single-line enum:', { prefix, enumValues, suffix });
			
			const values = this.forceSplitEnumValues(enumValues);
			if (values.length > 1) {
				return prefix + '\n' + values.join('\n') + '\n' + suffix;
			} else {
				return match;
			}
		});
		
		console.log('Preprocessed result:', processed);
		return processed;
	}
	
	// 强制分割枚举值 - 修复缩进问题
	private forceSplitEnumValues(enumStr: string): string[] {
		console.log('Force splitting enum values:', enumStr);
		
		const values = [];
		let current = '';
		let parenCount = 0;
		
		enumStr = enumStr.trim();
		const indentStr = ' '.repeat(this.settings.indentSize); // 使用用户设置的缩进
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = enumStr.length * 2; // 设置最大迭代次数
		
		for (let i = 0; i < enumStr.length && safetyCounter < maxIterations; i++, safetyCounter++) {
			const char = enumStr[i];
			
			if (char === '(') parenCount++;
			else if (char === ')') parenCount--;
			else if (char === ',' && parenCount === 0) {
				const value = current.trim();
				if (value) {
					values.push(indentStr + value + ','); // 使用设置的缩进
				}
				current = '';
				continue;
			}
			
			current += char;
		}
		
		// 添加最后一个值（不带逗号）
		const lastValue = current.trim();
		if (lastValue) {
			values.push(indentStr + lastValue); // 使用设置的缩进，不加逗号
		}
		
		console.log('Force split enum values result:', values);
		return values;
	}

	// 格式化令牌
	private formatTokens(tokens: ASN1Token[]): string {
		const lines: string[] = [];
		let currentLevel = 0;
		const indentSize = this.settings.indentSize;
		
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			const nextToken = tokens[i + 1];
			
			switch (token.type) {
				case 'module-definition':
					lines.push(token.content);
					break;
					
				case 'begin':
					lines.push(this.indent(token.content, currentLevel, indentSize));
					currentLevel++;
					// 在BEGIN后添加空行
					lines.push('');
					break;
					
				case 'end':
					currentLevel = Math.max(0, currentLevel - 1);
					// 在END前添加空行
					if (lines[lines.length - 1] !== '') {
						lines.push('');
					}
					lines.push(this.indent(token.content, currentLevel, indentSize));
					break;
					
				case 'type-name':
					lines.push(this.indent(token.content, currentLevel, indentSize));
					break;
					
				case 'type-definition':
					lines.push(this.indent(token.content, currentLevel, indentSize));
					currentLevel++;
					break;
					
				case 'opening-brace':
					lines.push(this.indent(token.content, currentLevel, indentSize));
					currentLevel++;
					break;
					
				case 'field':
					lines.push(this.indent(token.content, currentLevel, indentSize));
					break;
					
				case 'closing-brace':
					currentLevel = Math.max(0, currentLevel - 1);
					lines.push(this.indent(token.content, currentLevel, indentSize));
					// 在结构定义后添加空行（除非是最后一个或下一个是END）
					if (nextToken && nextToken.type !== 'end' && nextToken.type !== 'closing-brace') {
						lines.push('');
					}
					break;
					
				case 'comment':
					if (this.settings.autoWrapLongLines) {
						const wrappedComment = this.wrapComment(token.content, currentLevel, indentSize);
						lines.push(...wrappedComment);
					} else {
						lines.push(this.indent(token.content, currentLevel, indentSize));
					}
					break;
					
				default:
					lines.push(this.indent(token.content, currentLevel, indentSize));
					break;
			}
		}
		
		return lines.filter((line, index) => {
			// 移除连续的空行，但保留单个空行用于分隔
			if (line === '') {
				return index === 0 || index === lines.length - 1 || lines[index - 1] !== '';
			}
			return true;
		}).join('\n');
	}

	// 辅助方法
	private indent(content: string, level: number, size: number): string {
		return ' '.repeat(level * size) + content;
	}

	// 规范化单个字段内容：去除行尾逗号、压缩多余空格
	private normalizeFieldContent(raw: string): string {
		let s = (raw ?? '').trim();
		// 移除行尾逗号（由格式化器统一添加）
		s = s.replace(/,\s*$/,'');
		// 压缩空白
		s = s.replace(/\s+/g, ' ');
		return s;
	}

	// 顶层逗号拆分（忽略括号/大括号/方括号与字符串内的逗号）
	private splitTopLevelByComma(input: string): string[] {
		const parts: string[] = [];
		let current = '';
		let brace = 0, paren = 0, bracket = 0;
		let inString = false;
		for (let i = 0; i < input.length; i++) {
			const ch = input[i];
			const prev = i > 0 ? input[i-1] : '';
			if (ch === '"' && prev !== '\\') {
				inString = !inString;
			}
			if (!inString) {
				if (ch === '{') brace++;
				else if (ch === '}') brace--;
				else if (ch === '(') paren++;
				else if (ch === ')') paren--;
				else if (ch === '[') bracket++;
				else if (ch === ']') bracket--;
				else if (ch === ',' && brace === 0 && paren === 0 && bracket === 0) {
					parts.push(this.normalizeFieldContent(current));
					current = '';
					continue;
				}
			}
			current += ch;
		}
		if (current.trim().length > 0) {
			parts.push(this.normalizeFieldContent(current));
		}
		return parts;
	}
	
	// 判断是否为模块定义
	private isModuleDefinition(line: string): boolean {
		return /^\w+\s+DEFINITIONS\s+.*::=\s+BEGIN$/.test(line);
	}
	
	// 判断是否为类型定义
	private isTypeDefinition(line: string): boolean {
		return /^\w+\s*::=/.test(line);
	}
	
	// 判断是否为字段定义
	private isFieldDefinition(line: string): boolean {
		return /^\w+\s+\w+/.test(line) && !line.includes('::=') && !line.includes('DEFINITIONS');
	}
	
	// 判断是否为注释
	private isComment(line: string): boolean {
		return line.startsWith('--') || (line.startsWith('-*') && line.endsWith('*-'));
	}
	

	
	// 解析字段列表
	private parseFieldList(fieldsStr: string): ASN1Token[] {
		const tokens: ASN1Token[] = [];
		const fields = this.splitFields(fieldsStr);
		
		for (const field of fields) {
			if (field.trim()) {
				tokens.push({ type: 'field', content: field, level: 1 });
			}
		}
		
		return tokens;
	}
	
	// 智能分割字段 - 改进版本，更好地处理复杂字段
	private splitFields(fieldsStr: string): string[] {
		console.log('Splitting fields from:', fieldsStr);
		
		// 移除首尾空格和可能的闭合大括号
		fieldsStr = fieldsStr.replace(/^\s*\{\s*/, '').replace(/\s*\}\s*$/, '').trim();
		
		const fields = [];
		let current = '';
		let braceCount = 0;
		let parenCount = 0;
		let bracketCount = 0;
		let inString = false;
		
		for (let i = 0; i < fieldsStr.length; i++) {
			const char = fieldsStr[i];
			const prevChar = i > 0 ? fieldsStr[i - 1] : '';
			
			// 处理字符串
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				// 跟踪嵌套层级
				if (char === '{') braceCount++;
				else if (char === '}') braceCount--;
				else if (char === '(') parenCount++;
				else if (char === ')') parenCount--;
				else if (char === '[') bracketCount++;
				else if (char === ']') bracketCount--;
				
				// 在所有嵌套都关闭的情况下，逗号是字段分隔符
				else if (char === ',' && braceCount === 0 && parenCount === 0 && bracketCount === 0) {
					const fieldContent = current.trim();
					if (fieldContent) {
						fields.push(fieldContent + ',');
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段（不带逗号）
		const lastField = current.trim();
		if (lastField) {
			fields.push(lastField);
		}
		
		console.log('Split fields result:', fields);
		return fields;
	}
	
	// 强制分割字段 - 用于处理嵌套结构
	private forceSplitFields(fieldsStr: string): string[] {
		console.log('Force splitting fields:', fieldsStr);
		
		const fields = [];
		let current = '';
		let braceCount = 0;
		let parenCount = 0;
		let bracketCount = 0;
		let inString = false;
		
		// 清理输入字符串
		fieldsStr = fieldsStr.trim();
		
		const indentStr = ' '.repeat(this.settings.indentSize); // 使用用户设置的缩进
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = fieldsStr.length * 2; // 设置最大迭代次数
		
		for (let i = 0; i < fieldsStr.length && safetyCounter < maxIterations; i++, safetyCounter++) {
			const char = fieldsStr[i];
			const prevChar = i > 0 ? fieldsStr[i - 1] : '';
			
			// 处理字符串
			if (char === '"' && prevChar !== '\\') {
				inString = !inString;
			}
			
			if (!inString) {
				// 跟踪嵌套层级
				if (char === '{') braceCount++;
				else if (char === '}') braceCount--;
				else if (char === '(') parenCount++;
				else if (char === ')') parenCount--;
				else if (char === '[') bracketCount++;
				else if (char === ']') bracketCount--;
				
				// 在最外层遇到逗号时分割
				else if (char === ',' && braceCount === 0 && parenCount === 0 && bracketCount === 0) {
					const fieldContent = current.trim();
					if (fieldContent) {
						fields.push(indentStr + fieldContent + ','); // 使用设置的缩进
					}
					current = '';
					continue;
				}
			}
			
			current += char;
		}
		
		// 添加最后一个字段（不带逗号）
		const lastField = current.trim();
		if (lastField) {
			fields.push(indentStr + lastField); // 使用设置的缩进，不加逗号
		}
		
		console.log('Force split fields result:', fields);
		return fields;
	}
	
	// 解析枚举值
	private parseEnumValues(enumStr: string): ASN1Token[] {
		const tokens: ASN1Token[] = [];
		const values = this.splitEnumValues(enumStr);
		
		for (const value of values) {
			if (value.trim()) {
				tokens.push({ type: 'field', content: value, level: 1 });
			}
		}
		
		return tokens;
	}
	
	// 分割枚举值
	private splitEnumValues(enumStr: string): string[] {
		const values = [];
		let current = '';
		let parenCount = 0;
		
		// 添加安全计数器，防止无限循环
		let safetyCounter = 0;
		const maxIterations = enumStr.length * 2; // 设置最大迭代次数
		
		for (let i = 0; i < enumStr.length && safetyCounter < maxIterations; i++, safetyCounter++) {
			const char = enumStr[i];
			
			if (char === '(') parenCount++;
			else if (char === ')') parenCount--;
			else if (char === ',' && parenCount === 0) {
				values.push(current.trim() + ',');
				current = '';
				continue;
			}
			
			current += char;
		}
		
		if (current.trim()) {
			values.push(current.trim());
		}
		
		console.log('Force split enum values result:', values);
		return values;
	}
	
	// 增强的后处理格式化
	private enhancedPostProcessing(code: string): string {
		let processed = code;
		
		// 确保操作符周围有适当的空格
		processed = processed.replace(/::=/g, ' ::= ');
		processed = processed.replace(/\s+::=\s+/g, ' ::= ');
		
		// 处理逗号后的空格
		processed = processed.replace(/,(\S)/g, ', $1');
		
		// 处理大括号的格式
		processed = processed.replace(/\{\s+/g, '{');
		processed = processed.replace(/\s+\}/g, '}');
		
		// 处理 OPTIONAL 和 DEFAULT 的格式
		processed = processed.replace(/\s+OPTIONAL/g, ' OPTIONAL');
		processed = processed.replace(/\s+DEFAULT/g, ' DEFAULT');
		
		// 处理枚举值的格式
		processed = processed.replace(/(\w+)\s*\((\d+)\)/g, '$1($2)');
		
		// 处理标签的格式
		processed = processed.replace(/\[\s*(\d+)\s*\]/g, '[$1]');
		processed = processed.replace(/\[\s*(APPLICATION|UNIVERSAL|PRIVATE|CONTEXT)\s+(\d+)\s*\]/g, '[$1 $2]');
		
		// 处理 SEQUENCE OF、SET OF 的格式
		processed = processed.replace(/SEQUENCE\s+OF/g, 'SEQUENCE OF');
		processed = processed.replace(/SET\s+OF/g, 'SET OF');
		
		// 确保关键字前后有适当的空格
		processed = processed.replace(/(\w)IMPLICIT/g, '$1 IMPLICIT');
		processed = processed.replace(/(\w)EXPLICIT/g, '$1 EXPLICIT');
		processed = processed.replace(/IMPLICIT(\w)/g, 'IMPLICIT $1');
		processed = processed.replace(/EXPLICIT(\w)/g, 'EXPLICIT $1');
		
		// 确保大括号后面换行格式正确
		processed = processed.replace(/\{\s*\n\s*\n/g, '{\n');
		processed = processed.replace(/\}\s*\n\s*\n\s*(\w)/g, '}\n\n$1');
		
		// 在模块定义后确保有空行
		processed = processed.replace(/(DEFINITIONS\s+.*::=\s+BEGIN)\n/g, '$1\n\n');
		
		// 在 END 前确保有空行
		processed = processed.replace(/\n(\s*)END\s*$/gm, '\n\n$1END');
		
		return processed;
	}

	// 设置全局自动格式化功能 - 全新实现
	setupGlobalAutoFormatting() {
		console.log('Setting up global auto formatting...');
		
		// 监听所有编辑器事件
		this.registerEvent(
			this.app.workspace.on('editor-change', (editor: Editor) => {
				this.handleEditorChange(editor);
			})
		);
		
		console.log('Global auto formatting setup complete');
	}
	
	// 处理编辑器内容变化
	handleEditorChange(editor: Editor) {
		if (!editor) return;
		if (this.formattingInProgress) return;
		
		// 检查是否在ASN.1代码块中并启用了formatOnSave
		if (this.settings.formatOnSave) {
			const cursor = editor.getCursor();
			if (cursor && this.isASN1CodeBlock(editor)) {
				// 检查最后输入的字符
				const currentLine = editor.getLine(cursor.line);
				if (currentLine && cursor.ch > 0) {
					const lastChar = currentLine.charAt(cursor.ch - 1);
					
					// 在输入特定字符后触发格式化
					if (lastChar === '}' || lastChar === ';' || lastChar === ',' || lastChar === ')' || lastChar === ']') {
						console.log('Trigger character detected:', lastChar);
						setTimeout(() => {
							if (this.isASN1CodeBlock(editor)) {
								this.autoFormatCurrentBlock(editor);
							}
						}, 200);
					}
				}
			}
		}
		
		// 处理Enter键自动格式化
		if (this.settings.autoFormatOnEnter) {
			// 我们将在下一个tick中检查是否在ASN.1块中
			setTimeout(() => {
				if (this.formattingInProgress) return;
				if (this.isASN1CodeBlock(editor)) {
					const cursor = editor.getCursor();
					if (cursor && cursor.ch === 0 && cursor.line > 0) {
						// 如果光标在行首且不是第一行，可能刚按了Enter
						console.log('Detected potential Enter key press in ASN.1 block');
						this.autoFormatCurrentBlock(editor);
					}
				}
			}, 100);
		}
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		// 应用自定义颜色
		this.applyCustomColors();
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

		new Setting(containerEl)
			.setName('Max Line Length')
			.setDesc('Maximum line length before wrapping (40-120 characters)')
			.addSlider((slider: any) => slider
				.setLimits(40, 120, 5)
				.setValue(this.plugin.settings.maxLineLength)
				.setDynamicTooltip()
				.onChange(async (value: number) => {
					this.plugin.settings.maxLineLength = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto Wrap Long Lines')
			.setDesc('Automatically wrap long lines during formatting')
			.addToggle((toggle: any) => toggle
				.setValue(this.plugin.settings.autoWrapLongLines)
				.onChange(async (value: boolean) => {
					this.plugin.settings.autoWrapLongLines = value;
					await this.plugin.saveSettings();
				}));
		
		// 增强自动格式化设置分组
		(containerEl as any).createEl('h3', {text: 'Auto Formatting'});
		
		new Setting(containerEl)
			.setName('Auto Format on Exit')
			.setDesc('Automatically format ASN.1 code when leaving the code block')
			.addToggle((toggle: any) => toggle
				.setValue(this.plugin.settings.autoFormatOnExit)
				.onChange(async (value: boolean) => {
					this.plugin.settings.autoFormatOnExit = value;
					await this.plugin.saveSettings();
					// 重新设置自动格式化，使更改立即生效
					const activeView = this.app.workspace.getActiveViewOfType('markdown' as any);
					if (activeView && (activeView as any).editor) {
						this.plugin.setupAutoFormatting((activeView as any).editor);
					}
				}));
		
		new Setting(containerEl)
			.setName('Auto Format on Enter')
			.setDesc('Automatically format ASN.1 code when pressing Enter key in code block')
			.addToggle((toggle: any) => toggle
				.setValue(this.plugin.settings.autoFormatOnEnter)
				.onChange(async (value: boolean) => {
					this.plugin.settings.autoFormatOnEnter = value;
					await this.plugin.saveSettings();
					// 重新设置自动格式化，使更改立即生效
					const activeView = this.app.workspace.getActiveViewOfType('markdown' as any);
					if (activeView && (activeView as any).editor) {
						this.plugin.setupAutoFormatting((activeView as any).editor);
					}
				}));

		// 颜色设置分组
		(containerEl as any).createEl('h3', {text: 'Color Settings'});
		
		// 亮色主题颜色设置
		(containerEl as any).createEl('h4', {text: 'Light Theme Colors'});
		this.createColorSettings(containerEl, 'colors', 'Light theme');
		
		// 暗色主题颜色设置
		(containerEl as any).createEl('h4', {text: 'Dark Theme Colors'});
		this.createColorSettings(containerEl, 'darkColors', 'Dark theme');
		
		// 重置按钮
		new Setting(containerEl)
			.setName('Reset Colors')
			.setDesc('Reset all colors to default values')
			.addButton((button: any) => button
				.setButtonText('Reset to Defaults')
				.setCta()
				.onClick(async () => {
					this.plugin.settings.colors = {...DEFAULT_SETTINGS.colors};
					this.plugin.settings.darkColors = {...DEFAULT_SETTINGS.darkColors};
					await this.plugin.saveSettings();
					this.plugin.applyCustomColors();
					this.display(); // 重新渲染设置面板
				}));
	}
	
	// 创建颜色设置项
	createColorSettings(containerEl: HTMLElement, colorKey: 'colors' | 'darkColors', themeDesc: string) {
		const colorTypes = [
			{ key: 'keyword', name: 'Keywords', desc: `Color for ASN.1 keywords (${themeDesc})` },
			{ key: 'string', name: 'Strings', desc: `Color for string literals (${themeDesc})` },
			{ key: 'comment', name: 'Comments', desc: `Color for comments (${themeDesc})` },
			{ key: 'number', name: 'Numbers', desc: `Color for numeric values (${themeDesc})` },
			{ key: 'punctuation', name: 'Punctuation', desc: `Color for punctuation marks (${themeDesc})` },
			{ key: 'variable', name: 'Variables', desc: `Color for variable names (${themeDesc})` },
			{ key: 'oid', name: 'Object Identifiers', desc: `Color for object identifiers (${themeDesc})` },
			{ key: 'tag', name: 'Tags', desc: `Color for ASN.1 tags (${themeDesc})` },
			{ key: 'operator', name: 'Operators', desc: `Color for operators (${themeDesc})` }
		];
		
		colorTypes.forEach(colorType => {
			new Setting(containerEl)
				.setName(colorType.name)
				.setDesc(colorType.desc)
				.addColorPicker((colorPicker: any) => colorPicker
					.setValue(this.plugin.settings[colorKey][colorType.key as keyof typeof this.plugin.settings.colors])
					.onChange(async (value: string) => {
						(this.plugin.settings[colorKey] as any)[colorType.key] = value;
						await this.plugin.saveSettings();
						this.plugin.applyCustomColors();
					}));
		});
	}
}
