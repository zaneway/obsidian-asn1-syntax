import ASN1Plugin from '../main';

describe('ASN1 Code Formatting', () => {
  let plugin: ASN1Plugin;

  beforeEach(() => {
    const mockApp = {};
    const mockManifest = {
      id: 'test-asn1-plugin',
      name: 'Test ASN.1 Plugin',
      version: '1.0.0',
      minAppVersion: '0.12.0',
      description: 'Test plugin',
      author: 'Test Author',
      isDesktopOnly: false
    };
    
    plugin = new ASN1Plugin(mockApp as any, mockManifest);
    plugin.settings = { indentSize: 2, formatOnSave: true };
  });

  describe('Basic Formatting', () => {
    it('should format simple SEQUENCE', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String,
age INTEGER
}`;

      const result = plugin.formatASN1Code(input);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('Person ::= SEQUENCE {');
      expect(lines[1]).toBe('  name UTF8String,');
      expect(lines[2]).toBe('  age INTEGER');
      expect(lines[3]).toBe('}');
    });

    it('should format with different indent sizes', () => {
      plugin.settings.indentSize = 4;
      
      const input = `Person ::= SEQUENCE {
name UTF8String
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('    name UTF8String');
    });
  });

  describe('Nested Structures', () => {
    it('should handle nested SEQUENCE', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String,
address SEQUENCE {
street UTF8String,
city UTF8String
}
}`;

      const result = plugin.formatASN1Code(input);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('Person ::= SEQUENCE {');
      expect(lines[1]).toBe('  name UTF8String,');
      expect(lines[2]).toBe('  address SEQUENCE {');
      expect(lines[3]).toBe('    street UTF8String,');
      expect(lines[4]).toBe('    city UTF8String');
      expect(lines[5]).toBe('  }');
      expect(lines[6]).toBe('}');
    });

    it('should handle multiple levels of nesting', () => {
      const input = `Root ::= SEQUENCE {
level1 SEQUENCE {
level2 SEQUENCE {
value INTEGER
}
}
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('      value INTEGER');
    });
  });

  describe('Comments', () => {
    it('should preserve single line comments', () => {
      const input = `-- Top level comment
Person ::= SEQUENCE {
name UTF8String, -- Name comment
age INTEGER
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('-- Top level comment');
      expect(result).toContain('name UTF8String, -- Name comment');
    });

    it('should preserve multi-line comments', () => {
      const input = `-* This is a 
multi-line comment *-
Person ::= SEQUENCE {
name UTF8String
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('-* This is a \nmulti-line comment *-');
    });
  });

  describe('Special ASN.1 Constructs', () => {
    it('should handle CHOICE', () => {
      const input = `Value ::= CHOICE {
number INTEGER,
text UTF8String
}`;

      const result = plugin.formatASN1Code(input);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('Value ::= CHOICE {');
      expect(lines[1]).toBe('  number INTEGER,');
      expect(lines[2]).toBe('  text UTF8String');
      expect(lines[3]).toBe('}');
    });

    it('should handle SET', () => {
      const input = `PersonSet ::= SET {
name UTF8String,
age INTEGER
}`;

      const result = plugin.formatASN1Code(input);
      expect(result).toContain('PersonSet ::= SET {');
      expect(result).toContain('  name UTF8String,');
      expect(result).toContain('  age INTEGER');
    });

    it('should handle ENUMERATED', () => {
      const input = `Status ::= ENUMERATED {
active(0),
inactive(1),
pending(2)
}`;

      const result = plugin.formatASN1Code(input);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('Status ::= ENUMERATED {');
      expect(lines[1]).toBe('  active(0),');
      expect(lines[2]).toBe('  inactive(1),');
      expect(lines[3]).toBe('  pending(2)');
      expect(lines[4]).toBe('}');
    });
  });

  describe('Module Structure', () => {
    it('should handle complete module', () => {
      const input = `TestModule DEFINITIONS ::= BEGIN
Person ::= SEQUENCE {
name UTF8String,
age INTEGER
}
END`;

      const result = plugin.formatASN1Code(input);
      const lines = result.split('\n');
      
      expect(lines[0]).toBe('TestModule DEFINITIONS ::= BEGIN');
      expect(lines[1]).toBe('  Person ::= SEQUENCE {');
      expect(lines[2]).toBe('    name UTF8String,');
      expect(lines[3]).toBe('    age INTEGER');
      expect(lines[4]).toBe('  }');
      expect(lines[5]).toBe('END');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty input', () => {
      const result = plugin.formatASN1Code('');
      expect(result).toBe('');
    });

    it('should handle only whitespace', () => {
      const result = plugin.formatASN1Code('   \n  \n  ');
      expect(result.trim()).toBe('');
    });

    it('should handle single line', () => {
      const result = plugin.formatASN1Code('Person ::= INTEGER');
      expect(result).toBe('Person ::= INTEGER');
    });

    it('should handle malformed brackets', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String
// Missing closing bracket`;
      
      // Should not throw and should handle gracefully
      expect(() => plugin.formatASN1Code(input)).not.toThrow();
    });
  });

  describe('Post Processing', () => {
    it('should clean up operator spacing', () => {
      const input = 'Person::=SEQUENCE{name UTF8String}';
      const result = plugin.formatASN1Code(input);
      
      expect(result).toContain(' ::= ');
      expect(result).not.toContain('::=');
    });

    it('should handle comma spacing', () => {
      const input = `Person ::= SEQUENCE {
name UTF8String,age INTEGER
}`;
      
      const result = plugin.formatASN1Code(input);
      expect(result).toContain(', age INTEGER');
    });
  });
});