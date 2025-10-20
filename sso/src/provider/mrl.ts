import {
  RedirectFn,
  GetUserInfoFn,
  UserListType,
  OrgListType,
  GetUserListFn,
  GetOrgListFn
} from '../type';
import * as crypto from 'crypto';
import * as ldap from 'ldapjs';
import { UserPrefix } from '../userPrefix';
// AES解密函数
function decryptAES(encryptedData: string, key: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const keyBuffer = Buffer.from(key, 'utf8');
    const keyHash = crypto.createHash('sha256').update(keyBuffer).digest();

    const decodedData = Buffer.from(encryptedData, 'base64');
    const iv = decodedData.subarray(0, 16);
    const encrypted = decodedData.subarray(16);

    const decipher = crypto.createDecipheriv(algorithm, keyHash, iv);
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error: any) {
    throw new Error(`AES解密失败: ${error.message}`);
  }
}

// URL安全Base64解码函数
function urlSafeBase64Decode(input: string): string {
  try {
    // 替换URL安全字符
    let base64 = input.replace(/-/g, '+').replace(/_/g, '/');

    // 添加必要的填充
    const padding = base64.length % 4;
    if (padding > 0) {
      base64 += '='.repeat(4 - padding);
    }

    // 先进行Base64解码，然后进行AES解密
    const aesKey = process.env.AES_ENCRYPTION_KEY || 'your-default-aes-key';
    return decryptAES(base64, aesKey);
  } catch (error: any) {
    throw new Error(`URL安全Base64解码失败: ${error.message}`);
  }
}

// 从解密数据中提取JSON数据的函数
function extractJsonFromDecryptedData(decryptedData: string): string {
  try {
    // 查找JSON数据的开始和结束位置
    const jsonStart = decryptedData.indexOf('{');
    const jsonEnd = decryptedData.lastIndexOf('}');
    
    if (jsonStart === -1 || jsonEnd === -1 || jsonStart >= jsonEnd) {
      throw new Error('未找到有效的JSON数据');
    }
    
    // 提取JSON字符串
    const jsonStr = decryptedData.substring(jsonStart, jsonEnd + 1);
    
    // 验证JSON格式
    JSON.parse(jsonStr);
    
    return jsonStr;
  } catch (error: any) {
    throw new Error(`提取JSON数据失败: ${error.message}`);
  }
}

// LDAP认证函数
function authenticateWithLDAP(username: string, password: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    // LDAP服务器配置
    const ldapServers = [
      { url: 'ldap://139.128.242.85:389', domain: 'Shanghai.marelli.it' },
      { url: 'ldap://139.128.242.104:389', domain: 'Shanghai.marelli.it' },
      { url: 'ldap://172.28.241.230:389', domain: 'Calsonickansei.co.jp' },
      { url: 'ldap://172.28.64.222:389', domain: 'Calsonickansei.co.jp' }
    ];

    let attempts = 0;
    const maxAttempts = ldapServers.length;

    function tryNextServer() {
      if (attempts >= maxAttempts) {
        reject(new Error('所有LDAP服务器认证失败'));
        return;
      }

      const server = ldapServers[attempts];
      attempts++;

      const client = ldap.createClient({
        url: server.url,
        timeout: 5000,
        connectTimeout: 5000
      });

      // 构建用户DN
      const userDN = `${username}@${server.domain}`;

      client.bind(userDN, password, (err) => {
        if (err) {
          console.log(`LDAP认证失败 - 服务器: ${server.url}, 错误: ${err.message}`);
          client.unbind();
          tryNextServer();
        } else {
          console.log(`LDAP认证成功 - 服务器: ${server.url}, 用户: ${username}`);
          client.unbind();
          resolve(true);
        }
      });

      client.on('error', (err) => {
        console.log(`LDAP连接错误 - 服务器: ${server.url}, 错误: ${err.message}`);
        tryNextServer();
      });
    }

    tryNextServer();
  });
}

export const mrl_getUserInfo: GetUserInfoFn = async (code: string) => {
  try {
    // 尝试解密code作为加密数据
    const decryptedData = urlSafeBase64Decode(code);
    
    // 从解密数据中提取JSON部分（处理C#加密时添加的时间戳）
    const jsonStr = extractJsonFromDecryptedData(decryptedData);
    const userData = JSON.parse(jsonStr);

    if (userData.userAcount && userData.passWord) {
      // 进行LDAP认证
      const isAuthenticated = await authenticateWithLDAP(userData.userAcount, userData.passWord);

      if (isAuthenticated) {
        return {
          username: `${UserPrefix.MRL}-${userData.userAcount}`,
          avatar: '',
          contact: '',
          memberName: userData.userAcount
        };
      } else {
        throw new Error('LDAP认证失败');
      }
    } else {
      throw new Error('解密数据格式不正确');
    }
  } catch (decryptError: any) {
    // 解密失败，抛出错误
    throw new Error(`认证失败: ${decryptError.message}`);
  }
};

export const mrl_redirectFn: RedirectFn = async ({ req, redirect_uri, state }) => {
  const redirectUrl = `${process.env.MRL_LOGIN_URL}?redirect_uri=${redirect_uri}&state=${state}`;
  return { redirectUrl };
};
