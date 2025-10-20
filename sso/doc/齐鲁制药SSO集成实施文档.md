# 齐鲁制药 SSO 集成实施文档

## 概述

本文档详细记录了齐鲁制药 IAM 系统与 FastGPT SSO 服务的集成实施过程，包括代码实现、配置方法和使用说明。

## 集成架构

齐鲁制药 SSO 集成基于类 OAuth2 授权码模式，认证流程如下：

```
用户访问 FastGPT
       ↓
重定向到齐鲁制药 IAM 授权页面
       ↓
用户在齐鲁制药 IAM 完成认证
       ↓
齐鲁制药 IAM 返回授权码
       ↓
FastGPT 使用授权码调用齐鲁制药 API 获取用户信息
       ↓
完成用户登录
```

## 实施步骤

### 1. 代码实现

#### 1.1 创建齐鲁制药 Provider

创建文件 `src/provider/qilu.ts`，实现以下功能：

- `qilu_redirectFn`: 构建齐鲁制药 IAM 授权 URL
- `qilu_getUserInfo`: 通过授权码获取用户信息

```typescript
import axios from 'axios';
import { getErrText } from '../utils';
import { GetUserInfoFn, RedirectFn } from '../type';

// 构建齐鲁制药 IAM 授权 URL
export const qilu_redirectFn: RedirectFn = async () => {
  const baseUrl = process.env.QILU_IAM_BASE_URL;
  const systemCode = process.env.QILU_SYSTEM_CODE;
  const redirectUri = process.env.QILU_REDIRECT_URI;

  const authUrl = `${baseUrl}/api/sso/authorize?systemCode=${systemCode}&redirectUri=${encodeURIComponent(redirectUri!)}`;
  
  return {
    redirectUrl: authUrl
  };
};

// 通过授权码获取用户信息
export const qilu_getUserInfo: GetUserInfoFn = async (data) => {
  try {
    const code = data.code;
    const baseUrl = process.env.QILU_IAM_BASE_URL;
    const systemCode = process.env.QILU_SYSTEM_CODE;

    const response = await axios.post(`${baseUrl}/api/sso/getUserInfo`, {
      code,
      systemCode
    });

    const userData = response.data.data;
    
    return {
      username: userData.memberName || userData.username,
      avatar: userData.avatar || '',
      contact: userData.phone || userData.email || ''
    };
  } catch (error) {
    console.error('齐鲁制药获取用户信息失败:', error);
    throw new Error(`获取用户信息失败: ${getErrText(error)}`);
  }
};
```

#### 1.2 注册 Provider

在 `src/provider/index.ts` 中注册齐鲁制药 provider：

```typescript
// 添加导入
import { qilu_redirectFn, qilu_getUserInfo } from './qilu';

// 在 providerMap 中添加
qilu: {
  redirectFn: qilu_redirectFn,
  getUserInfo: qilu_getUserInfo
}
```

### 2. 环境变量配置

在 `.env.template` 文件中添加齐鲁制药相关配置：

```bash
# 齐鲁制药 IAM
SSO_PROVIDER=qilu
SSO_TARGET_URL=http://localhost:3001/login/success
QILU_IAM_BASE_URL=https://iam.qilu.com
QILU_SYSTEM_CODE=your_system_code
QILU_REDIRECT_URI=http://localhost:3000/api/oauth/qilu
```

### 3. 配置说明

| 环境变量 | 说明 | 示例值 |
|---------|------|--------|
| SSO_PROVIDER | SSO 提供商标识 | qilu |
| SSO_TARGET_URL | 认证成功后的跳转地址 | http://localhost:3001/login/success |
| QILU_IAM_BASE_URL | 齐鲁制药 IAM 基础 URL | https://iam.qilu.com |
| QILU_SYSTEM_CODE | 齐鲁制药分配的系统代码 | your_system_code |
| QILU_REDIRECT_URI | OAuth 回调地址 | http://localhost:3000/api/oauth/qilu |

## 部署指南

### 1. 环境准备

1. 确保已安装 Node.js 和 bun
2. 安装项目依赖：`bun install`

### 2. 配置环境变量

1. 复制 `.env.template` 为 `.env`
2. 根据实际情况填写齐鲁制药相关环境变量
3. 确保 `SSO_PROVIDER=qilu`

### 3. 启动服务

开发环境：
```bash
npm run dev
```

生产环境：
```bash
npm run build
npm start
```

### 4. Docker 部署

构建镜像：
```bash
docker buildx build --platform=linux/amd64 -f ./projects/sso/Dockerfile -t fastgpt-sso:latest .
```

运行容器：
```bash
docker run -d \
  --name fastgpt-sso \
  -p 3000:3000 \
  -e SSO_PROVIDER=qilu \
  -e SSO_TARGET_URL=http://your-domain/login/success \
  -e QILU_IAM_BASE_URL=https://iam.qilu.com \
  -e QILU_SYSTEM_CODE=your_system_code \
  -e QILU_REDIRECT_URI=http://your-domain:3000/api/oauth/qilu \
  fastgpt-sso:latest
```

## 使用流程

### 1. 用户访问

用户访问 FastGPT 应用时，如果未登录，系统会自动重定向到齐鲁制药 IAM 认证页面。

### 2. 认证流程

1. 用户在齐鲁制药 IAM 页面完成身份认证
2. 齐鲁制药 IAM 重定向回 FastGPT，携带授权码
3. FastGPT 使用授权码调用齐鲁制药 API 获取用户信息
4. 完成用户登录，跳转到目标页面

### 3. 用户信息映射

齐鲁制药用户信息映射到 FastGPT 标准格式：

| 齐鲁制药字段 | FastGPT 字段 | 说明 |
|-------------|-------------|------|
| memberName/username | username | 用户名 |
| avatar | avatar | 头像 URL |
| phone/email | contact | 联系方式 |

## 故障排查

### 1. 常见问题

#### 问题：重定向失败
- 检查 `QILU_IAM_BASE_URL` 是否正确
- 检查 `QILU_SYSTEM_CODE` 是否有效
- 检查 `QILU_REDIRECT_URI` 是否与齐鲁制药 IAM 配置一致

#### 问题：获取用户信息失败
- 检查授权码是否有效
- 检查网络连接是否正常
- 查看服务日志获取详细错误信息

#### 问题：用户信息不完整
- 检查齐鲁制药 API 返回的数据结构
- 确认用户在齐鲁制药 IAM 中的信息是否完整

### 2. 日志查看

查看服务日志：
```bash
# Docker 环境
docker logs fastgpt-sso

# 直接运行
npm run dev
```

### 3. 调试模式

开启详细日志：
```bash
DEBUG=* npm run dev
```

## 安全注意事项

1. **环境变量保护**：确保生产环境中的敏感信息（如 `QILU_SYSTEM_CODE`）得到妥善保护
2. **HTTPS 使用**：生产环境必须使用 HTTPS 协议
3. **回调地址验证**：确保 `QILU_REDIRECT_URI` 配置正确，避免重定向攻击
4. **授权码有效期**：注意授权码的有效期限制，及时处理过期情况

## 技术支持

如遇到技术问题，请联系：
- FastGPT 技术支持团队
- 齐鲁制药 IAM 技术支持

## 更新日志

### v1.0.0 (2024-01-XX)
- 初始版本
- 实现齐鲁制药 IAM SSO 集成
- 支持用户信息获取和映射
- 完善错误处理和日志记录

---

*本文档最后更新时间：2024-01-XX*