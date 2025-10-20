import { RedirectFn, GetUserInfoFn, OrgListType, GetUserListFn, GetOrgListFn } from '../type';
import axios from 'axios';
import jwt from 'jsonwebtoken';
import { UserPrefix } from '../userPrefix';

type AccessToken = {
  value: string;
  expire: number;
};

/** Cached Access Token */
const access_token: {
  normal?: AccessToken;
  sync?: AccessToken;
} = {};

type userInfo = {
  username: string;
  memberName: string;
  avatar?: string;
  contact?: string;
  orgs: string[];
};

const userList: userInfo[] = [];

// 获取 Access Token 的 URL
const getAccessTokenURL =
  process.env.WECOM_TOKEN_URL || 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';

// 获取用户 ID, 消费 code 换 id, user_ticket
const getUserIdURL =
  process.env.WECOM_GET_USER_ID_URL || 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo';

// 获取用户敏感信息，消费 user_ticket
const getUserDetailURL =
  process.env.WECOM_GET_USER_INFO_URL || 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserdetail';

// 获取用户基本信息
const getUserInfoURL =
  process.env.WECOM_GET_USER_NAME_URL || 'https://qyapi.weixin.qq.com/cgi-bin/user/get';

// 通过 OAuth (在企业微信终端打开，直接登陆) 的 URL
const wecomTargetURLOAuth =
  process.env.WECOM_TARGET_URL_OAUTH || 'https://open.weixin.qq.com/connect/oauth2/authorize';
// 非企业微信终端，扫码登陆的 URL
const wecomTargetURLSSO =
  process.env.WECOM_TARGET_URL_SSO || 'https://login.work.weixin.qq.com/wwlogin/sso/login ';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

//超级管理员账号密码
const username = process.env.JINTIAN_API_USERNAME || 'admin';
const password = process.env.JINTIAN_API_PASSWORD || 'b09a37e3bf584ccfa5f04fd00c2f8dc9';

// 获取部门列表
const orgApiUrl = process.env.JINTIAN_ORG_API_URL || 'http://192.168.61.55:7080/getorglist';

// 获取用户列表
const getUserListURL = process.env.JINTIAN_USER_API_URL || 'http://192.168.61.55:7080/getuserlist';

const corpid = process.env.WECOM_CORPID || '';
const agentid = process.env.WECOM_AGENTID || '';
const appSecret = process.env.WECOM_APP_SECRET || '';

export const jintian_redirectFn: RedirectFn = async ({ req, redirect_uri, state }) => {
  console.log('[jintian_redirectFn] 输入参数:', { redirect_uri, state, query: req.query });
  const isWecomWorkTerminal = req.query.isWecomWorkTerminal as '1' | '0';
  const corpid = process.env.WECOM_CORPID || '';
  const agentid = process.env.WECOM_AGENTID || '';
  console.log('[jintian_redirectFn] 环境变量:', { corpid, agentid, isWecomWorkTerminal });
  if (isWecomWorkTerminal === '1') {
    const url = new URL(wecomTargetURLOAuth);
    url.searchParams.set('appid', corpid);
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_privateinfo');
    url.searchParams.set('agentid', agentid);
    url.searchParams.set('state', state);
    const redirectUrl = url.toString() + '#wechat_redirect';
    console.log('[jintian_redirectFn] OAuth重定向URL:', redirectUrl);
    return { redirectUrl };
  } else {
    const url = new URL(wecomTargetURLSSO);
    url.searchParams.set('login_type', 'CorpApp');
    url.searchParams.set('appid', corpid);
    url.searchParams.set('agentid', agentid);
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('state', state);
    const redirectUrl = url.toString();
    console.log('[jintian_redirectFn] SSO重定向URL:', redirectUrl);
    return { redirectUrl };
  }
};

//获取鉴权token
async function getAccessToken({
  corpid,
  secret,
  isSyncSecret
}: {
  corpid: string;
  secret: string;
  isSyncSecret?: boolean;
}) {
  console.log('[getAccessToken] 请求参数:', { corpid, isSyncSecret, hasSecret: !!secret });
  if (isSyncSecret && access_token.sync && access_token.sync.expire > Date.now()) {
    console.log('[getAccessToken] 使用缓存的sync token');
    return access_token.sync.value;
  }
  if (!isSyncSecret && access_token.normal && access_token.normal.expire > Date.now()) {
    console.log('[getAccessToken] 使用缓存的normal token');
    return access_token.normal.value;
  }
  // otherwise, get a new access token
  console.log('[getAccessToken] 请求新token:', { url: getAccessTokenURL });
  const { data } = await axios.request<{
    errcode: number;
    errmsg: string;
    access_token: string;
    expires_in: number;
  }>({
    url: getAccessTokenURL,
    method: 'POST',
    data: {
      corpid,
      corpsecret: secret
    }
  });

  console.log('[getAccessToken] API响应:', {
    errcode: data.errcode,
    errmsg: data.errmsg,
    hasToken: !!data.access_token,
    expires_in: data.expires_in
  });

  if (!data.access_token) {
    console.error('[getAccessToken] 获取token失败:', data.errmsg);
    return Promise.reject(data.errmsg);
  }

  const expire = Date.now() + data.expires_in * 1000 - 10000; // 10s before expiration
  access_token[isSyncSecret ? 'sync' : 'normal'] = {
    value: data.access_token,
    expire
  };
  console.log('[getAccessToken] 新token已缓存:', {
    type: isSyncSecret ? 'sync' : 'normal',
    expire: new Date(expire)
  });
  return data.access_token;
}

//获取微信的用户信息
export const wecom_getUserInfo: GetUserInfoFn = async (code: string) => {
  console.log('[wecom_getUserInfo] 开始获取微信用户信息:', { code, corpid, agentid });
  if (!corpid || !agentid) {
    console.error('[wecom_getUserInfo] 缺少必要参数:', { corpid, agentid });
    throw new Error('corpid or agentid is required');
  }

  // 1. get access_token
  console.log('[wecom_getUserInfo] 步骤1: 获取access_token');
  const access_token = await getAccessToken({
    corpid,
    secret: appSecret
  });
  console.log('[wecom_getUserInfo] access_token获取成功:', { hasToken: !!access_token });

  // 2. get userid
  console.log('[wecom_getUserInfo] 步骤2: 获取userid');
  const userIdResponse = await axios.get(getUserIdURL, {
    params: {
      code,
      access_token
    }
  });

  console.log('[wecom_getUserInfo] userid响应:', userIdResponse.data);
  const { userid, user_ticket, errmsg } = userIdResponse.data;
  if (!userid) {
    console.error('[wecom_getUserInfo] 获取userid失败:', { errmsg, response: userIdResponse.data });
    throw new Error(errmsg || 'Fail to get wecom userid');
  }
  console.log('[wecom_getUserInfo] userid获取成功:', { userid, hasUserTicket: !!user_ticket });

  // 3. get userInfo
  console.log('[wecom_getUserInfo] 步骤3: 获取用户详细信息');
  const userInfoURL = new URL(getUserDetailURL);
  userInfoURL.searchParams.set('access_token', access_token);

  const userInfoResponse = await axios.post(userInfoURL.toString(), {
    user_ticket
  });

  console.log('[wecom_getUserInfo] 用户详细信息响应:', userInfoResponse.data);
  const userDetail = userInfoResponse.data;

  // 4. get username
  console.log('[wecom_getUserInfo] 步骤4: 获取用户名称');
  const usernameURL = new URL(getUserInfoURL);
  usernameURL.searchParams.set('access_token', access_token);
  usernameURL.searchParams.set('userid', userid);

  const usernameResponse = await axios.get(usernameURL.toString());
  console.log('[wecom_getUserInfo] 用户名称响应:', usernameResponse.data);
  const { name } = usernameResponse.data;



  const result = {
    username: `${UserPrefix.JINTIAN}-${userid}`,
    contact: '',
    avatar: ''
  };
  console.log('[wecom_getUserInfo] 返回用户信息:', result);
  return result;
};

//匹配用户信息
export const jintian_getUserInfo: GetUserInfoFn = async (code: string) => {
  console.log('[jintian_getUserInfo] 开始处理用户信息:', { code: code.substring(0, 20) + '...' });
  try {
    // 解密JWT token
    console.log('[jintian_getUserInfo] 尝试JWT解密');
    const decoded = jwt.verify(code, JWT_SECRET, {
      algorithms: ['HS256']
    }) as { username: string };
    const username_decoded = decoded.username;
    console.log('[jintian_getUserInfo] JWT解密成功:', { username_decoded });

    const result = {
      username: `${UserPrefix.JINTIAN}-${username_decoded}`,
      contact: '',
      avatar: ''
    };
    console.log('[jintian_getUserInfo] JWT用户信息返回:', result);
    return result;
  } catch (error) {
    console.log('[jintian_getUserInfo] JWT解密失败，尝试微信登录:', {
      error: error instanceof Error ? error.message : String(error)
    });
    return await wecom_getUserInfo(code);
  }
};

//获取组织列表
export const jintian_getOrgList: GetOrgListFn = async () => {
  console.log('[jintian_getOrgList] 开始获取组织列表:', { url: orgApiUrl });
  const orgList: OrgListType = [];

  const { data } = await axios.request<{
    success: boolean;
    message: string;
    orgList: Array<{
      id: string;
      name: string;
      parentId: string;
    }>;
  }>({
    url: orgApiUrl,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
  });

  console.log('[jintian_getOrgList] API响应:', {
    success: data.success,
    message: data.message,
    orgCount: data.orgList?.length
  });

  if (!data.success) {
    console.error('[jintian_getOrgList] API调用失败:', data.message);
    throw new Error(`API Error: ${data.message}`);
  }

  data.orgList.forEach((org) => {
    orgList.push({
      id: org.id,
      name: org.name,
      parentId: org.parentId || ''
    });
  });

  console.log('[jintian_getOrgList] 组织列表处理完成:', { count: orgList.length, orgs: orgList });

  return orgList;
};

//获取用户列表
export const jintian_getUserList: GetUserListFn = async () => {
  console.log('[jintian_getUserList] 开始获取用户列表:', { url: getUserListURL });
  const { data } = await axios.request<{
    success: boolean;
    message: string;
    userList: Array<{
      username: string;
      memberName: string;
      avatar?: string;
      contact?: string;
      orgs: string[];
    }>;
  }>({
    url: getUserListURL,
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
    }
  });

  console.log('[jintian_getUserList] API响应:', {
    success: data.success,
    message: data.message,
    userCount: data.userList?.length
  });

  if (!data.success) {
    console.error('[jintian_getUserList] API调用失败:', data.message);
    throw new Error(`API Error: ${data.message}`);
  }

  // 转换数据并添加前缀
  console.log('[jintian_getUserList] 开始转换用户数据:', { originalCount: data.userList.length });
  const transformedUsers = data.userList.map((user) => ({
    username: `${UserPrefix.JINTIAN}-${user.username}`,
    memberName: user.memberName || user.username, // 如果没有 memberName 则使用 username
    avatar: user.avatar || '',
    contact: user.contact || '',
    orgs: user.orgs || []
  }));

  // 更新全局 userList 用于后续的用户信息查找
  console.log('[jintian_getUserList] 更新全局userList:', {
    oldCount: userList.length,
    newCount: transformedUsers.length
  });
  userList.length = 0; // 清空现有数据
  userList.push(...transformedUsers);
  console.log('[jintian_getUserList] 用户列表更新完成:', {
    users: transformedUsers.map((u) => ({ username: u.username, memberName: u.memberName }))
  });

  return transformedUsers;
};
