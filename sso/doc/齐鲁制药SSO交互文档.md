# 齐鲁制药 SSO 交互文档

## 概述

本文档详细描述了齐鲁制药 IAM 系统与 FastGPT SSO 服务的集成实现，包括认证流程、API 接口、数据传递方式和配置说明。齐鲁制药 SSO 基于类 OAuth2 授权码模式，支持动态 redirect_uri 处理。

## 技术架构

### 认证流程图

```
用户访问 FastGPT
       ↓
重定向到齐鲁制药 IAM 认证页面
       ↓
用户在齐鲁制药 IAM 完成身份认证
       ↓
齐鲁制药 IAM 返回授权码 (code)
       ↓
FastGPT SSO 服务调用齐鲁制药 API 获取用户信息
       ↓
完成用户登录并重定向到目标页面
```

### 核心组件

1. **qilu_redirectFn**：构建齐鲁制药 IAM 授权 URL
2. **qilu_getUserInfo**：通过授权码获取用户信息
3. **动态 redirect_uri 处理**：支持灵活的回调地址配置

## API 接口详解

### 1. 认证重定向接口

**功能**：构建齐鲁制药 IAM 授权 URL

**实现函数**：`qilu_redirectFn`

**输入参数**：
```typescript
{
  redirect_uri: string;  // 认证成功后的回调地址
  state?: string;        // 状态参数，用于防止 CSRF 攻击
}
```

**处理逻辑**：
1. 验证环境变量配置（`QILU_IAM_BASE_URL`、`QILU_SYSTEM_CODE`）
2. 构建授权 URL：`{baseUrl}/auth/login`
3. 添加查询参数：
   - `systemCode`：系统代码
   - `redirect_uri`：回调地址
   - `state`：状态参数

**返回结果**：
```typescript
{
  redirectUrl: string;  // 完整的授权 URL
}
```

**示例 URL**：
```
https://iam.qilu.com/auth/login?systemCode=fastgpt&redirect_uri=http%3A//localhost%3A3000/api/oauth/callback&state=abc123
```

### 2. 用户信息获取接口

**功能**：通过授权码获取用户信息

**实现函数**：`qilu_getUserInfo`

**输入参数**：
```typescript
code: string;  // 齐鲁制药 IAM 返回的授权码
```

**API 调用**：
- **URL**：`{baseUrl}/baseservice-1.0/iamToDownStream/authLoginlam`
- **方法**：POST
- **请求体**：
  ```json
  {
    "code": "授权码",
    "systemCode": "系统代码"
  }
  ```
- **超时时间**：10秒

**响应处理**：
1. 检查响应状态码（`data.code` 必须为 '0'）
2. 提取用户信息（`data.data`）
3. 标准化用户信息格式

**返回结果**：
```typescript
{
  username: string;     // 用户名
  avatar: string;       // 头像 URL（当前为空字符串）
  contact: string;      // 联系方式（用户代码）
  memberName: string;   // 成员名称
}
```

## 数据传递机制

### 1. 动态 redirect_uri 处理

齐鲁制药 SSO 实现支持动态 `redirect_uri` 处理，与企业微信的实现方式保持一致：

```typescript
// 接收动态传入的 redirect_uri
export const qilu_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  // 直接使用传入的 redirect_uri，而非环境变量
  const authUrl = new URL('/auth/login', baseUrl);
  authUrl.searchParams.append('redirect_uri', redirect_uri);
  // ...
};
```

**优势**：
- 提高了灵活性，支持多种回调场景
- 与其他 SSO 提供商保持一致的接口设计
- 便于测试和多环境部署

### 2. 用户信息映射

齐鲁制药用户信息到 FastGPT 标准格式的映射关系：

| 齐鲁制药字段 | FastGPT 字段 | 说明 |
|-------------|-------------|------|
| userName | username | 用户名 |
| userName | memberName | 成员名称 |
| userCode | contact | 用户代码作为联系方式 |
| - | avatar | 头像（当前为空） |

### 3. 错误处理机制

**重定向阶段错误**：
- 配置缺失检查
- URL 构建异常处理
- 详细错误日志记录

**用户信息获取阶段错误**：
- 网络请求超时处理
- API 响应状态检查
- 用户信息完整性验证

## 环境配置

### 必需环境变量

```bash
# SSO 基础配置
SSO_PROVIDER=qilu
SSO_TARGET_URL=http://localhost:3001/login/success

# 齐鲁制药 IAM 配置
QILU_IAM_BASE_URL=https://iam.qilu.com
QILU_SYSTEM_CODE=your_system_code
```

### 配置说明

| 环境变量 | 说明 | 示例值 | 必填 |
|---------|------|--------|------|
| SSO_PROVIDER | SSO 提供商标识 | qilu | 是 |
| SSO_TARGET_URL | 认证成功后的跳转地址 | http://localhost:3001/login/success | 是 |
| QILU_IAM_BASE_URL | 齐鲁制药 IAM 基础 URL | https://iam.qilu.com | 是 |
| QILU_SYSTEM_CODE | 齐鲁制药分配的系统代码 | fastgpt_system | 是 |

**注意**：不再需要配置 `QILU_REDIRECT_URI` 环境变量，因为已改为动态处理。

## 完整认证流程

### 1. 初始化认证

**请求**：
```http
GET /api/oauth/auth?redirect_uri=http://localhost:3001/login/success&state=abc123
```

**处理过程**：
1. SSO 服务调用 `qilu_redirectFn`
2. 构建齐鲁制药 IAM 授权 URL
3. 返回重定向 URL

**响应**：
```json
{
  "success": true,
  "message": "",
  "authURL": "https://iam.qilu.com/auth/login?systemCode=fastgpt_system&redirect_uri=http%3A//localhost%3A3001/login/success&state=abc123"
}
```

### 2. 用户认证

用户在齐鲁制药 IAM 页面完成身份认证后，系统会重定向回 SSO 服务：

```http
GET /api/oauth/callback?code=auth_code_123&state=abc123
```

### 3. 获取用户信息

**API 调用**：
```http
POST https://iam.qilu.com/baseservice-1.0/iamToDownStream/authLoginlam
Content-Type: application/json

{
  "code": "auth_code_123",
  "systemCode": "fastgpt_system"
}
```

**API 响应**：
```json
{
  "code": "0",
  "msg": "success",
  "data": {
    "userName": "张三",
    "userCode": "zhangsan",
    "departmentName": "技术部"
  }
}
```

### 4. 完成登录

最终重定向到目标页面，携带用户信息：

```http
GET http://localhost:3001/login/success?username=张三&contact=zhangsan&memberName=张三
```

## 安全机制

### 1. 状态参数验证

- 使用 `state` 参数防止 CSRF 攻击
- 确保认证请求和回调的状态一致性

### 2. 配置验证

- 启动时检查必需的环境变量
- 运行时验证配置完整性

### 3. 请求安全

- 设置合理的请求超时时间（10秒）
- 使用 HTTPS 协议进行 API 调用
- 详细的错误日志记录

### 4. 数据验证

- 验证授权码的有效性
- 检查 API 响应的完整性
- 确保用户信息的必需字段存在

## 故障排查

### 常见问题

#### 1. 重定向失败

**症状**：无法跳转到齐鲁制药 IAM 认证页面

**排查步骤**：
1. 检查 `QILU_IAM_BASE_URL` 配置
2. 验证 `QILU_SYSTEM_CODE` 是否正确
3. 确认网络连接正常
4. 查看 SSO 服务日志

**解决方案**：
```bash
# 检查环境变量
echo $QILU_IAM_BASE_URL
echo $QILU_SYSTEM_CODE

# 测试网络连接
curl -v https://iam.qilu.com/health
```

#### 2. 获取用户信息失败

**症状**：认证成功但无法获取用户信息

**排查步骤**：
1. 检查授权码是否有效
2. 验证 API 端点是否正确
3. 确认请求格式符合要求
4. 查看 API 响应内容

**解决方案**：
```bash
# 手动测试 API
curl -X POST https://iam.qilu.com/baseservice-1.0/iamToDownStream/authLoginlam \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code","systemCode":"your_system_code"}'
```

#### 3. 用户信息不完整

**症状**：部分用户信息缺失

**排查步骤**：
1. 检查齐鲁制药 API 返回的数据结构
2. 确认用户在 IAM 系统中的信息完整性
3. 验证字段映射逻辑

### 调试模式

启用详细日志：

```bash
# 开发环境
DEBUG=* npm run dev

# 生产环境
NODE_ENV=production LOG_LEVEL=debug npm start
```

查看容器日志：

```bash
docker logs fastgpt-sso -f
```

## 部署指南

### 开发环境

1. **配置环境变量**：
   ```bash
   cp .env.template .env
   # 编辑 .env 文件，填入齐鲁制药相关配置
   ```

2. **启动服务**：
   ```bash
   bun install
   npm run dev
   ```

3. **测试认证流程**：
   ```bash
   curl "http://localhost:3000/api/oauth/auth?redirect_uri=http://localhost:3001/login/success&state=test"
   ```

### 生产环境

1. **Docker 部署**：
   ```bash
   docker run -d \
     --name fastgpt-sso \
     -p 3000:3000 \
     -e SSO_PROVIDER=qilu \
     -e SSO_TARGET_URL=https://your-domain/login/success \
     -e QILU_IAM_BASE_URL=https://iam.qilu.com \
     -e QILU_SYSTEM_CODE=your_system_code \
     fastgpt-sso:latest
   ```

2. **健康检查**：
   ```bash
   curl http://localhost:3000/health
   ```

3. **监控日志**：
   ```bash
   docker logs fastgpt-sso -f
   ```

## 性能优化

### 1. 请求优化

- 设置合理的超时时间
- 使用连接池复用 HTTP 连接
- 实现请求重试机制

### 2. 缓存策略

- 缓存用户信息（短期）
- 缓存系统配置
- 使用 Redis 存储会话状态

### 3. 监控指标

- 认证成功率
- API 响应时间
- 错误率统计
- 并发用户数

## 更新日志

### v2.0.0 (2024-01-XX)
- 🎉 支持动态 redirect_uri 处理
- 🔧 优化错误处理机制
- 📝 完善日志记录
- 🚀 提升性能和稳定性

### v1.0.0 (2024-01-XX)
- 🎯 初始版本
- ✅ 实现齐鲁制药 IAM SSO 集成
- 🔐 支持用户信息获取和映射
- 🛡️ 完善安全机制

---

*本文档最后更新时间：2024-01-XX*
*适用版本：FastGPT SSO v2.0.0+*