// 简单的测试脚本，用于验证ASN.1格式化修复
const fs = require('fs');

// 读取测试文件
const testContent = fs.readFileSync('./test-cert-request.md', 'utf8');
console.log('原始内容:');
console.log(testContent);

// 模拟ASN.1格式化逻辑的关键部分
function testFormatLogic() {
  // 模拟多行类型定义解析
  const lines = [
    "CertificationRequest ::= SEQUENCE {",
    "    certificationRequestInfo  CertificationRequestInfo,",
    "    signatureAlgorithm        AlgorithmIdentifier,",
    "    signature                 BIT STRING",
    "}",
    "",
    "CertificationRequestInfo ::= SEQUENCE {",
    "    version             INTEGER { v1(0) } (v1,...),",
    "    subject             Name,",
    "    subjectPublicKeyInfo SubjectPublicKeyInfo,",
    "    attributes          [0] IMPLICIT Attributes",
    "}"
  ];
  
  console.log('\n模拟解析过程:');
  let braceCount = 1;
  let i = 1; // 从第一行开始（跳过开始行）
  
  console.log(`第0行: ${lines[0]} (braceCount: ${braceCount})`);
  
  while (i < lines.length && braceCount > 0) {
    const line = lines[i].trim();
    console.log(`第${i}行: ${line} (braceCount: ${braceCount})`);
    
    if (!line) {
      i++;
      continue;
    }
    
    // 计算大括号
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;
    braceCount += openBraces;
    braceCount -= closeBraces;
    
    console.log(`  开括号: ${openBraces}, 闭括号: ${closeBraces}, 新braceCount: ${braceCount}`);
    
    i++;
  }
  
  console.log(`\n解析完成，最终索引: ${i}, braceCount: ${braceCount}`);
}

testFormatLogic();