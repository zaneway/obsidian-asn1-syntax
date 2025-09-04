import ASN1Plugin from '../main';

// 模拟编辑器
const mockEditor = {
  getCursor: jest.fn(),
  lineCount: jest.fn(),
  getLine: jest.fn(),
  replaceRange: jest.fn(),
  getValue: jest.fn(),
  setValue: jest.fn()
};

// 模拟应用
const mockApp = {
  workspace: {
    on: jest.fn(),
    getActiveViewOfType: jest.fn()
  }
};

// 模拟插件清单
const mockManifest = {
  id: 'test-asn1-plugin',
  name: 'Test ASN.1 Plugin',
  version: '1.0.0',
  minAppVersion: '0.12.0',
  description: 'Test plugin',
  author: 'Test Author',
  isDesktopOnly: false
};

describe('ASN1Plugin', () => {
  let plugin: ASN1Plugin;

  beforeEach(() => {
    plugin = new ASN1Plugin(mockApp, mockManifest);
    // 初始化默认设置
    plugin.settings = {
      indentSize: 2,
      formatOnSave: true
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isASN1CodeBlock', () => {
    it('should return true when cursor is inside ASN.1 code block', () => {
      // 设置模拟数据
      mockEditor.getCursor.mockReturnValue({ line: 2, ch: 0 });
      mockEditor.lineCount.mockReturnValue(6);
      mockEditor.getLine.mockImplementation((line: number) => {
        const lines = [
          'Some text',
          '```asn1',
          'Person ::= SEQUENCE {',
          '  name UTF8String',
          '}',
          '```'
        ];
        return lines[line] || '';
      });

      const result = plugin.isASN1CodeBlock(mockEditor as any);
      expect(result).toBe(true);
    });

    it('should return false when cursor is outside ASN.1 code block', () => {
      mockEditor.getCursor.mockReturnValue({ line: 0, ch: 0 });
      mockEditor.lineCount.mockReturnValue(6);
      mockEditor.getLine.mockImplementation((line: number) => {
        const lines = [
          'Some text',
          '```asn1',
          'Person ::= SEQUENCE {',
          '  name UTF8String',
          '}',
          '```'
        ];
        return lines[line] || '';
      });

      const result = plugin.isASN1CodeBlock(mockEditor as any);
      expect(result).toBe(false);
    });

    it('should handle null cursor gracefully', () => {
      mockEditor.getCursor.mockReturnValue(null);
      mockEditor.lineCount.mockReturnValue(0);

      const result = plugin.isASN1CodeBlock(mockEditor as any);
      expect(result).toBe(false);
    });
  });

  describe('formatASN1Code', () => {
    it('should format simple ASN.1 code correctly', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String,
age INTEGER
}`;

      const expected = `Person ::= SEQUENCE {\n  name UTF8String,\n  age INTEGER\n}`;
      
      const result = plugin.formatASN1Code(input);
      expect(result).toBe(expected);
    });

    it('should handle nested structures', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String,
address Address
}
Address ::= SEQUENCE {
street UTF8String,
city UTF8String
}`;

      const result = plugin.formatASN1Code(input);
      
      // 验证结构是否正确缩进
      expect(result).toContain('Person ::= SEQUENCE {');
      expect(result).toContain('  name UTF8String,');
      expect(result).toContain('  address Address');
      expect(result).toContain('Address ::= SEQUENCE {');
      expect(result).toContain('  street UTF8String,');
      expect(result).toContain('  city UTF8String');
    });

    it('should preserve comments', () => {
      const input = `-- This is a comment
Person ::= SEQUENCE {
  name UTF8String -- Name field
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('-- This is a comment');
      expect(result).toContain('-- Name field');
    });

    it('should handle empty input', () => {
      const result = plugin.formatASN1Code('');
      expect(result).toBe('');
    });
  });

  describe('highlightASN1', () => {
    it('should highlight keywords correctly', () => {
      const element = document.createElement('code');
      element.textContent = 'SEQUENCE INTEGER BOOLEAN';
      
      plugin.highlightASN1(element);
      
      expect(element.innerHTML).toContain('<span class="asn1-keyword">SEQUENCE</span>');
      expect(element.innerHTML).toContain('<span class="asn1-keyword">INTEGER</span>');
      expect(element.innerHTML).toContain('<span class="asn1-keyword">BOOLEAN</span>');
    });

    it('should highlight comments correctly', () => {
      const element = document.createElement('code');
      element.textContent = '-- This is a comment\nSEQUENCE';
      
      plugin.highlightASN1(element);
      
      expect(element.innerHTML).toContain('<span class="asn1-comment">-- This is a comment</span>');
    });

    it('should highlight strings correctly', () => {
      const element = document.createElement('code');
      element.textContent = 'name "John Doe"';
      
      plugin.highlightASN1(element);
      
      expect(element.innerHTML).toContain('<span class="asn1-string">"John Doe"</span>');
    });

    it('should highlight numbers correctly', () => {
      const element = document.createElement('code');
      element.textContent = 'age 25';
      
      plugin.highlightASN1(element);
      
      expect(element.innerHTML).toContain('<span class="asn1-number">25</span>');
    });

    it('should highlight object identifiers correctly', () => {
      const element = document.createElement('code');
      element.textContent = 'id {1 2 3 4}';
      
      plugin.highlightASN1(element);
      
      expect(element.innerHTML).toContain('<span class="asn1-oid">{1 2 3 4}</span>');
    });

    it('should handle null element gracefully', () => {
      expect(() => {
        plugin.highlightASN1(null as any);
      }).not.toThrow();
    });

    it('should handle empty content gracefully', () => {
      const element = document.createElement('code');
      element.textContent = '';
      
      expect(() => {
        plugin.highlightASN1(element);
      }).not.toThrow();
    });
  });

  describe('loadSettings and saveSettings', () => {
    it('should load default settings when no data exists', async () => {
      plugin.loadData = jest.fn().mockResolvedValue(undefined);
      
      await plugin.loadSettings();
      
      expect(plugin.settings.indentSize).toBe(2);
      expect(plugin.settings.formatOnSave).toBe(true);
    });

    it('should merge loaded settings with defaults', async () => {
      plugin.loadData = jest.fn().mockResolvedValue({ indentSize: 4 });
      
      await plugin.loadSettings();
      
      expect(plugin.settings.indentSize).toBe(4);
      expect(plugin.settings.formatOnSave).toBe(true); // 默认值
    });

    it('should save settings correctly', async () => {
      plugin.saveData = jest.fn().mockResolvedValue(undefined);
      plugin.settings = { indentSize: 4, formatOnSave: false };
      
      await plugin.saveSettings();
      
      expect(plugin.saveData).toHaveBeenCalledWith({ indentSize: 4, formatOnSave: false });
    });
  });
});