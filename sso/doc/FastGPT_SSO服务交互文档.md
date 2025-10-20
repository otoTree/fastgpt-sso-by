# FastGPT SSO 服务交互文档

## 概述

FastGPT SSO 服务是专门为私有化用户提供的单点登录（SSO）集成服务，支持多种主流的身份认证提供商。本文档详细描述了 SSO 服务的架构设计、API 接口、数据流转方式以及各种 SSO 提供商的集成方法。

## 服务架构

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   FastGPT 主应用  │    │   SSO 服务       │    │   第三方 IdP     │
│                 │    │                 │    │                 │
│  1. 用户访问     │───▶│  2. 重定向构建   │───▶│  3. 用户认证     │
│  4. 接收回调     │◀───│  5. 获取用户信息 │◀───│  6. 返回授权码   │
│  7. 完成登录     │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 核心组件

1. **Provider 管理器**：统一管理各种 SSO 提供商的实现
2. **认证控制器**：处理认证请求和回调
3. **用户信息映射器**：将第三方用户信息映射为标准格式
4. **组织同步器**：支持组织架构和用户列表同步（部分提供商）

## API 接口规范

### 1. 获取认证 URL

**接口地址**：`GET /api/oauth/auth`

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| redirect_uri | string | 是 | 认证成功后的回调地址 |
| state | string | 否 | 状态参数，用于防止 CSRF 攻击 |

**响应格式**：

```json
{
  "success": true,
  "message": "",
  "authURL": "https://idp.example.com/oauth/authorize?..."
}
```

**错误响应**：

```json
{
  "error": "redirect_uri is required"
}
```

### 2. 处理认证回调

**接口地址**：`GET /api/oauth/callback`

**请求参数**：

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| code | string | 是 | 授权码 |
| state | string | 否 | 状态参数 |

**响应**：重定向到目标 URL，携带用户信息

### 3. SAML 元数据（仅 SAML 提供商）

**接口地址**：`GET /api/saml/metadata`

**响应**：XML 格式的 SAML 元数据

### 4. 获取用户列表（支持的提供商）

**接口地址**：`GET /api/users`

**响应格式**：

```json
{
  "success": true,
  "data": [
    {
      "username": "user1",
      "avatar": "https://example.com/avatar1.jpg",
      "contact": "user1@example.com"
    }
  ]
}
```

### 5. 获取组织列表（支持的提供商）

**接口地址**：`GET /api/orgs`

**响应格式**：

```json
{
  "success": true,
  "data": [
    {
      "id": "dept1",
      "name": "技术部",
      "parentId": "root"
    }
  ]
}
```

## 数据流转机制

### 1. OAuth 2.0 流程（主流方式）

```
1. 用户访问 FastGPT
   ↓
2. FastGPT 调用 SSO 服务获取认证 URL
   GET /api/oauth/auth?redirect_uri=xxx&state=xxx
   ↓
3. SSO 服务构建第三方认证 URL
   Provider.redirectFn({ redirect_uri, state })
   ↓
4. 用户重定向到第三方 IdP 完成认证
   ↓
5. 第三方 IdP 回调 SSO 服务
   GET /api/oauth/callback?code=xxx&state=xxx
   ↓
6. SSO 服务获取用户信息
   Provider.getUserInfo({ code })
   ↓
7. 重定向到 FastGPT 并传递用户信息
   redirect_uri?username=xxx&avatar=xxx&contact=xxx
```

### 2. SAML 2.0 流程

```
1. 用户访问 FastGPT
   ↓
2. FastGPT 调用 SSO 服务获取认证 URL
   ↓
3. SSO 服务构建 SAML 认证请求
   ↓
4. 用户重定向到 IdP 完成认证
   ↓
5. IdP POST SAML 断言到 SSO 服务
   ↓
6. SSO 服务验证断言并提取用户信息
   ↓
7. 重定向到 FastGPT 并传递用户信息
```

### 3. 数据传递格式

#### 标准用户信息格式

```typescript
interface UserInfo {
  username: string;    // 用户名
  avatar?: string;     // 头像 URL
  contact?: string;    // 联系方式（邮箱或手机）
}
```

#### 组织信息格式

```typescript
interface OrgInfo {
  id: string;          // 组织 ID
  name: string;        // 组织名称
  parentId?: string;   // 父组织 ID
}
```

## 支持的 SSO 提供商

### 1. 企业微信（wecom）

**特点**：
- 支持用户信息获取
- 支持组织架构同步
- 支持用户列表同步
- 使用 Access Token 缓存机制

**配置参数**：
```bash
SSO_PROVIDER=wecom
WECOM_CORP_ID=企业ID
WECOM_CORP_SECRET=企业密钥
WECOM_AGENT_ID=应用ID
```

**数据传递方式**：动态 redirect_uri

### 2. 飞书（feishu）

**特点**：
- 支持用户信息获取
- 支持组织架构同步
- 支持用户列表同步

**配置参数**：
```bash
SSO_PROVIDER=feishu
FEISHU_APP_ID=应用ID
FEISHU_APP_SECRET=应用密钥
FEISHU_REDIRECT_URI=回调地址
```

**数据传递方式**：环境变量配置 redirect_uri

### 3. 钉钉（dingtalk）

**特点**：
- 支持用户信息获取

**配置参数**：
```bash
SSO_PROVIDER=dingtalk
DINGTALK_APP_KEY=应用Key
DINGTALK_APP_SECRET=应用密钥
```

**数据传递方式**：动态 redirect_uri

### 4. 齐鲁制药（qilu）

**特点**：
- 支持用户信息获取
- 类 OAuth2 授权码模式

**配置参数**：
```bash
SSO_PROVIDER=qilu
QILU_IAM_BASE_URL=IAM基础URL
QILU_SYSTEM_CODE=系统代码
```

**数据传递方式**：动态 redirect_uri（已优化）

### 5. 通用 OAuth2（oauth2）

**特点**：
- 标准 OAuth2 实现
- 可配置各种 OAuth2 兼容的提供商

**配置参数**：
```bash
SSO_PROVIDER=oauth2
OAUTH2_CLIENT_ID=客户端ID
OAUTH2_CLIENT_SECRET=客户端密钥
OAUTH2_AUTH_URL=授权URL
OAUTH2_TOKEN_URL=令牌URL
OAUTH2_USER_URL=用户信息URL
```

### 6. SAML 提供商

#### 北京数字金融（bjsf）

**特点**：
- SAML 2.0 协议
- 支持元数据获取
- 支持断言验证

**配置参数**：
```bash
SSO_PROVIDER=bjsf
BJSF_IDP_SSO_URL=IdP SSO URL
BJSF_IDP_CERT=IdP 证书
```

#### 测试 SAML（testSaml）

**特点**：
- 用于 SAML 集成测试
- 完整的 SAML 2.0 实现

### 7. 其他提供商

- **leapmotor**：零跑汽车 SSO
- **tcl**：TCL 集团 SSO
- **aecc**：中国航发 SSO（支持回调处理）
- **hebamr**：河北 AMR SSO

## 环境配置

### 基础配置

```bash
# 必填配置
SSO_PROVIDER=提供商标识
SSO_TARGET_URL=认证成功后的跳转地址

# 可选配置
HOSTNAME=服务外部访问地址
REDIRECT=是否启用重定向检查
PORT=3000
```

### 提供商特定配置

每个提供商都有其特定的配置参数，详见各提供商的配置说明。

## 部署指南

### 1. 开发环境

```bash
# 安装依赖
bun install

# 启动开发服务
npm run dev
```

### 2. 生产环境

```bash
# 构建项目
npm run build

# 启动服务
npm start
```

### 3. Docker 部署

```bash
# 构建镜像
docker buildx build --platform=linux/amd64 \
  -f ./projects/sso/Dockerfile \
  -t fastgpt-sso:latest .

# 运行容器
docker run -d \
  --name fastgpt-sso \
  -p 3000:3000 \
  -e SSO_PROVIDER=wecom \
  -e SSO_TARGET_URL=http://your-domain/login/success \
  -e WECOM_CORP_ID=your_corp_id \
  -e WECOM_CORP_SECRET=your_corp_secret \
  -e WECOM_AGENT_ID=your_agent_id \
  fastgpt-sso:latest
```

## 安全机制

### 1. 状态参数验证

- 使用 `state` 参数防止 CSRF 攻击
- 验证回调时的状态参数一致性

### 2. 重定向地址验证

- 验证 `redirect_uri` 的合法性
- 防止开放重定向攻击

### 3. 令牌管理

- Access Token 缓存机制
- 令牌过期自动刷新
- 敏感信息加密存储

### 4. HTTPS 强制

- 生产环境强制使用 HTTPS
- 证书验证和 TLS 配置

## 错误处理

### 常见错误码

| 错误码 | 说明 | 解决方案 |
|--------|------|----------|
| 400 | 参数错误 | 检查请求参数 |
| 401 | 认证失败 | 检查认证配置 |
| 403 | 权限不足 | 检查用户权限 |
| 500 | 服务器错误 | 查看服务日志 |

### 调试方法

1. **启用详细日志**：
   ```bash
   DEBUG=* npm run dev
   ```

2. **查看容器日志**：
   ```bash
   docker logs fastgpt-sso
   ```

3. **网络连接测试**：
   ```bash
   curl -v https://idp.example.com/health
   ```

## 扩展开发

### 添加新的 SSO 提供商

1. **创建 Provider 文件**：
   ```typescript
   // src/provider/newprovider.ts
   export const newprovider_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
     // 实现重定向逻辑
   };
   
   export const newprovider_getUserInfo: GetUserInfoFn = async (data) => {
     // 实现用户信息获取
   };
   ```

2. **注册 Provider**：
   ```typescript
   // src/provider/index.ts
   import { newprovider_redirectFn, newprovider_getUserInfo } from './newprovider';
   
   const providerMap = {
     // ...
     newprovider: {
       redirectFn: newprovider_redirectFn,
       getUserInfo: newprovider_getUserInfo
     }
   };
   ```

3. **添加环境变量配置**：
   ```bash
   # .env.template
   NEWPROVIDER_CLIENT_ID=客户端ID
   NEWPROVIDER_CLIENT_SECRET=客户端密钥
   ```

### 接口类型定义

```typescript
// 重定向函数
type RedirectFn = (params: {
  req: Request;
  redirect_uri: string;
  state?: string;
}) => Promise<{ redirectUrl: string }>;

// 用户信息获取函数
type GetUserInfoFn = (data: any) => Promise<{
  username: string;
  avatar?: string;
  contact?: string;
}>;

// 组织列表获取函数
type GetOrgListFn = () => Promise<OrgListType[]>;

// 用户列表获取函数
type GetUserListFn = () => Promise<UserListType[]>;
```

## 性能优化

### 1. 缓存策略

- Access Token 缓存（企业微信、飞书等）
- 用户信息缓存
- 组织架构缓存

### 2. 连接池管理

- HTTP 连接复用
- 数据库连接池
- Redis 连接池

### 3. 监控指标

- 认证成功率
- 响应时间
- 错误率统计
- 并发用户数

## 最佳实践

### 1. 配置管理

- 使用环境变量管理敏感配置
- 配置文件版本控制
- 多环境配置隔离

### 2. 日志记录

- 结构化日志格式
- 敏感信息脱敏
- 日志级别控制

### 3. 测试策略

- 单元测试覆盖
- 集成测试验证
- 压力测试评估

## 技术支持

如遇到技术问题，请按以下步骤排查：

1. 检查环境变量配置
2. 查看服务日志
3. 验证网络连接
4. 测试第三方 API
5. 联系技术支持团队

---

*本文档最后更新时间：2024-01-XX*
*文档版本：v1.0.0*