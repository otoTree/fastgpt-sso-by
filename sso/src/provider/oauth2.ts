// OAUTH2.0 Authorization reference: https://www.ruanyifeng.com/blog/2014/05/oauth_2_0.html
import axios from 'axios';
import type { GetUserInfoFn, RedirectFn } from '../type';

const OAuth2AuthorizeURL = process.env.OAUTH2_AUTHORIZE_URL || '';
const OAuth2TokenURL = process.env.OAUTH2_TOKEN_URL || '';
const OAuth2UserInfoURL = process.env.OAUTH2_USER_INFO_URL || '';

const ClientID = process.env.OAUTH2_CLIENT_ID || '';
const ClientSecret = process.env.OAUTH2_CLIENT_SECRET || '';
const Scope = process.env.OAUTH2_SCOPE || '';

const OAuth2UsernameMap = process.env.OAUTH2_USERNAME_MAP || '';
const OAuth2AvatarMap = process.env.OAUTH2_AVATAR_MAP || '';
const OAuth2MemberNameMap = process.env.OAUTH2_MEMBER_NAME_MAP || '';
const OAuth2ContactMap = process.env.OAUTH2_CONTACT_MAP || '';

let cache_redirect_uri = '';

// 初始化时打印配置信息


function getNestedValue(obj: any, path: string): any {
  console.log('[OAuth2] getNestedValue 调用:', { path, objKeys: obj ? Object.keys(obj) : 'null/undefined' });
  
  if (!path) {
    console.log('[OAuth2] getNestedValue: path为空，返回undefined');
    return undefined;
  }

  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      console.log('[OAuth2] getNestedValue: 在路径', key, '处遇到null/undefined，返回undefined');
      return undefined;
    }
    current = current[key];
    console.log('[OAuth2] getNestedValue: 访问键', key, '，当前值:', current);
  }

  console.log('[OAuth2] getNestedValue 最终结果:', current);
  return current;
}

export const oauth2_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  console.log('[OAuth2] oauth2_redirectFn 开始执行，参数:', { redirect_uri, state });
  
  try {
    // parse the redirect_uri
    const url = new URL(OAuth2AuthorizeURL);
    console.log('[OAuth2] 创建授权URL，基础URL:', OAuth2AuthorizeURL);
    
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('client_id', ClientID);
    url.searchParams.set('response_type', 'code');
    
    if (Scope) {
      url.searchParams.set('scope', Scope);
      console.log('[OAuth2] 添加scope参数:', Scope);
    }
    
    if (state) {
      url.searchParams.set('state', state);
      console.log('[OAuth2] 添加state参数:', state);
    }

    cache_redirect_uri = redirect_uri;
    console.log('[OAuth2] 缓存redirect_uri:', cache_redirect_uri);
    
    const redirectUrl = url.toString();
    console.log('[OAuth2] 生成的重定向URL:', redirectUrl);
    
    const result = {
      redirectUrl
    };
    
    console.log('[OAuth2] oauth2_redirectFn 执行成功，返回结果:', result);
    return result;
  } catch (error) {
    console.error('[OAuth2] oauth2_redirectFn 执行出错:', error);
    throw error;
  }
};

export const oauth2_getUserInfo: GetUserInfoFn = async (code: string) => {
  console.log('[OAuth2] oauth2_getUserInfo 开始执行，参数:', { code });
  
  try {
    // 第一步：获取access_token
    console.log('[OAuth2] 步骤1: 获取access_token');
    const tokenRequestData = {
      grant_type: 'authorization_code',
      client_id: ClientID,
      code,
      redirect_uri: cache_redirect_uri,
      ...(ClientSecret ? { client_secret: ClientSecret } : {})
    };
    
    console.log('[OAuth2] Token请求参数:', {
      ...tokenRequestData,
      client_secret: ClientSecret ? '***已配置***' : '未配置'
    });
    
    const tokenResponse = await axios.request({
      url: OAuth2TokenURL,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      data: new URLSearchParams(tokenRequestData)
    });
    
    console.log('[OAuth2] Token响应状态:', tokenResponse.status);
    console.log('[OAuth2] Token响应数据:', tokenResponse.data);
    
    const { access_token } = tokenResponse.data;
    console.log('[OAuth2] 获取到access_token:', access_token ? '***已获取***' : '未获取到');

    // 第二步：获取用户信息
    console.log('[OAuth2] 步骤2: 获取用户信息');
    const userInfoResponse = await axios.request({
      url: OAuth2UserInfoURL,
      method: 'get',
      headers: {
        Authorization: `Bearer ${access_token}`
      }
    });
    
    console.log('[OAuth2] 用户信息响应状态:', userInfoResponse.status);
    console.log('[OAuth2] 用户信息响应数据:', userInfoResponse.data);

    const { data } = userInfoResponse;

    // 第三步：提取用户字段
    console.log('[OAuth2] 步骤3: 提取用户字段');
    const username = getNestedValue(data, OAuth2UsernameMap);
    const avatar = getNestedValue(data, OAuth2AvatarMap);
    const memberName = getNestedValue(data, OAuth2MemberNameMap);
    const contact = getNestedValue(data, OAuth2ContactMap);

    const result = {
      username,
      avatar,
      memberName,
      contact
    };
    
    console.log('[OAuth2] 提取的用户信息:', result);
    console.log('[OAuth2] oauth2_getUserInfo 执行成功');
    
    return result;
  } catch (error) {
    console.error('[OAuth2] oauth2_getUserInfo 执行出错:', error);
    if ((error as any).response) {
      console.error('[OAuth2] 错误响应状态:', (error as any).response.status);
      console.error('[OAuth2] 错误响应数据:', (error as any).response.data);
    }
    throw error;
  }
};
