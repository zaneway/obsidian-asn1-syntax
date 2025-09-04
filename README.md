# Obsidian ASN.1 Syntax 插件

这是一个为 Obsidian 提供 ASN.1 (Abstract Syntax Notation One) 语法高亮和格式化功能的插件。
（原生的Markdown无法识别ASN.1语法）

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.4.4-blue.svg)](https://www.typescriptlang.org/)
[![Obsidian](https://img.shields.io/badge/Obsidian-0.12.0+-purple.svg)](https://obsidian.md/)

## ✨ 功能特性

- 🎨 **ASN.1 语法高亮显示** - 支持完整的 ASN.1 语法元素高亮

- 🔧 **智能代码格式化** - 自动格式化 ASN.1 代码块

- ⚡ **保存时自动格式化** - 可配置的保存时自动格式化功能

- 🌙 **暗黑模式支持** - 完美适配 Obsidian 的明暗主题
  

## 🚀 安装方法


### 手动安装

1. 下载最新的发布版本
2. 解压文件到 `.obsidian/plugins/obsidian-asn1-syntax/` 目录下
3. 重启 Obsidian 并在设置中启用插件

### 从源码构建

```bash
# 克隆仓库
git clone https://github.com/yourusername/obsidian-asn1-syntax.git

# 进入目录
cd obsidian-asn1-syntax

# 安装依赖
npm install

# 构建插件
npm run build
```

## 📖 使用方法

### 基础语法高亮

在 Markdown 文件中使用 \`\`\`asn1 代码块来启用 ASN.1 语法高亮：

````markdown
```asn1
MyModule DEFINITIONS ::= BEGIN

Person ::= SEQUENCE {
    name UTF8String,
    age INTEGER,
    address Address OPTIONAL
}

Address ::= SEQUENCE {
    street UTF8String,
    city UTF8String,
    zipCode NumericString
}

END
```
````

### 代码格式化

有两种方式格式化 ASN.1 代码：

1. **命令面板格式化**：
   - 将光标放在 ASN.1 代码块内
   - 打开命令面板（`Ctrl/Cmd + P`）
   - 搜索并执行 "Format ASN.1" 命令

2. **保存时自动格式化**：
   - 在插件设置中启用「保存时格式化」
   - 每次保存文件时会自动格式化 ASN.1 代码块

### 支持的 ASN.1 语法元素

插件支持完整的 ASN.1 语法高亮，包括：

#### 基本类型
- `BOOLEAN`, `INTEGER`, `BIT STRING`, `OCTET STRING`
- `NULL`, `OBJECT IDENTIFIER`, `REAL`, `ENUMERATED`

#### 字符串类型
- `UTF8String`, `NumericString`, `PrintableString`
- `IA5String`, `VisibleString`, `UniversalString`
- `BMPString`, `TeletexString`, `GeneralString`

#### 构造类型
- `SEQUENCE`, `SET`, `CHOICE`

#### 时间类型
- `UTCTime`, `GeneralizedTime`

#### 标记和约束
- `[UNIVERSAL n]`, `[APPLICATION n]`, `[PRIVATE n]`, `[CONTEXT n]`
- `IMPLICIT`, `EXPLICIT`, `OPTIONAL`, `DEFAULT`
- `SIZE`, `WITH COMPONENT`, `WITH COMPONENTS`

#### 模块定义
- `DEFINITIONS`, `BEGIN`, `END`
- `EXPORTS`, `IMPORTS`, `FROM`

### 高亮示例

```asn1
-- 这是单行注释
-* 
这是多行注释
*-

X509Certificate DEFINITIONS IMPLICIT TAGS ::= BEGIN

Certificate ::= SEQUENCE {
    tbsCertificate       TBSCertificate,
    signatureAlgorithm   AlgorithmIdentifier,
    signatureValue       BIT STRING
}

TBSCertificate ::= SEQUENCE {
    version         [0] EXPLICIT Version DEFAULT v1,
    serialNumber         CertificateSerialNumber,
    signature            AlgorithmIdentifier,
    issuer               Name,
    validity             Validity,
    subject              Name,
    subjectPublicKeyInfo SubjectPublicKeyInfo,
    issuerUniqueID  [1]  IMPLICIT UniqueIdentifier OPTIONAL,
    subjectUniqueID [2]  IMPLICIT UniqueIdentifier OPTIONAL,
    extensions      [3]  EXPLICIT Extensions OPTIONAL
}

Version ::= INTEGER { v1(0), v2(1), v3(2) }

AlgorithmIdentifier ::= SEQUENCE {
    algorithm               OBJECT IDENTIFIER,
    parameters              ANY DEFINED BY algorithm OPTIONAL
}

END
```

## ⚙️ 设置选项

插件提供以下设置选项：

### 缩进大小
- **范围**：1-8 个空格
- **默认值**：2 个空格
- **描述**：设置格式化时使用的缩进空格数

### 保存时格式化
- **类型**：布尔值
- **默认值**：启用
- **描述**：启用或禁用保存文件时自动格式化 ASN.1 代码块

## 🛠️ 开发

### 环境要求

- Node.js 14+
- npm 或 yarn
- TypeScript 4.4+
- Obsidian 0.12.0+

### 开发设置

```bash
# 安装依赖
npm install

# 开发模式（热重载）
npm run dev

# 类型检查
npm run build

# 运行测试
npm test

# 代码检查
npm run lint

# 自动修复代码风格
npm run lint:fix
```

### 项目结构

```
obsidian-asn1-syntax/
├── main.ts              # 插件主文件
├── types.d.ts           # TypeScript 类型定义
├── manifest.json        # 插件清单文件
├── styles.css           # 语法高亮样式
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
├── esbuild.config.mjs   # 构建配置
├── jest.config.js       # 测试配置
├── .eslintrc.json       # ESLint 配置
├── tests/               # 测试文件
│   ├── setup.ts
│   ├── ASN1Plugin.test.ts
│   └── formatASN1Code.test.ts
└── README.md            # 项目文档
```

### 贡献指南

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 运行测试

```bash
# 运行所有测试
npm test

# 监视模式运行测试
npm run test:watch

# 生成覆盖率报告
npm test -- --coverage
```

## 🐛 问题报告

如果你发现了问题或有功能请求，请在 [GitHub Issues](https://github.com/zaneway/obsidian-asn1-syntax/issues) 页面提交。

## 📝 更新日志

### v1.0.0
- ✨ 初始版本发布
- 🎨 完整的 ASN.1 语法高亮支持
- 🔧 智能代码格式化功能
- ⚙️ 可配置的插件设置
- 🌙 明暗主题支持
- 🧪 完整的单元测试覆盖



## 🤝 贡献指南

感谢您对项目的关注！如果您想贡献代码，请：

1. Fork 项目仓库
2. 创建功能分支 (`git checkout -b feature/新功能`)
3. 提交更改 (`git commit -m '添加某个新功能'`)
4. 推送到分支 (`git push origin feature/新功能`)
5. 创建 Pull Request

---

## ⭐ 支持

- 如果插件对您有帮助，请给项目点个星！

## 📄 许可证

本项目使用 [MIT 许可证](LICENSE) - 查看 LICENSE 文件了解详细信息。

## 🔗 相关资源

- [ASN.1 标准文档](https://www.itu.int/rec/T-REC-X.680-X.693/)
- [Obsidian 插件开发文档](https://docs.obsidian.md/)
- [TypeScript 文档](https://www.typescriptlang.org/docs/)

## 赏口饭
* 支付宝<img width="467" height="582" alt="image" src="https://github.com/user-attachments/assets/cb8d9d82-a3ce-47be-8da8-71781870b1dd" />

* 微信<img width="389" height="377" alt="image" src="https://github.com/user-attachments/assets/1989bd76-e989-4559-9e54-ecc8fabfd51c" />

