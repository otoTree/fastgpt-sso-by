import { RedirectFn, GetUserInfoFn, OrgListType, GetUserListFn, GetOrgListFn } from '../type';
import axios from 'axios';
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

// 获取 Access Token 的 URL
const getAccessTokenURL =
  process.env.WECOM_TOKEN_URL || 'https://qyapi.weixin.qq.com/cgi-bin/gettoken';

// 通过 OAuth (在企业微信终端打开，直接登陆) 的 URL
const wecomTargetURLOAuth =
  process.env.WECOM_TARGET_URL_OAUTH || 'https://open.weixin.qq.com/connect/oauth2/authorize';
// 非企业微信终端，扫码登陆的 URL
const wecomTargetURLSSO =
  process.env.WECOM_TARGET_URL_SSO || 'https://login.work.weixin.qq.com/wwlogin/sso/login ';

// 获取用户 ID, 消费 code 换 id, user_ticket
const getUserIdURL =
  process.env.WECOM_GET_USER_ID_URL || 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserinfo';
// 获取用户敏感信息，消费 user_ticket
const getUserDetailURL =
  process.env.WECOM_GET_USER_INFO_URL || 'https://qyapi.weixin.qq.com/cgi-bin/auth/getuserdetail';
// 获取用户基本信息
const getUserInfoURL =
  process.env.WECOM_GET_USER_NAME_URL || 'https://qyapi.weixin.qq.com/cgi-bin/user/get';
// 获取部门列表
const getDepartmentListURL =
  process.env.WECOM_GET_DEPARTMENT_LIST_URL ||
  'https://qyapi.weixin.qq.com/cgi-bin/department/list';
// 获取用户列表
const getUserListURL =
  process.env.WECOM_GET_USER_LIST_URL || 'https://qyapi.weixin.qq.com/cgi-bin/user/list_id';

const corpid = process.env.WECOM_CORPID || '';
const agentid = process.env.WECOM_AGENTID || '';
const appSecret = process.env.WECOM_APP_SECRET || '';
const syncSecret = process.env.WECOM_SYNC_SECRET || '';

async function getAccessToken({
  corpid,
  secret,
  isSyncSecret
}: {
  corpid: string;
  secret: string;
  isSyncSecret?: boolean;
}) {
  if (isSyncSecret && access_token.sync && access_token.sync.expire > Date.now()) {
    return access_token.sync.value;
  }
  if (!isSyncSecret && access_token.normal && access_token.normal.expire > Date.now()) {
    return access_token.normal.value;
  }
  // otherwise, get a new access token
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

  if (!data.access_token) {
    return Promise.reject(data.errmsg);
  }

  const expire = Date.now() + data.expires_in * 1000 - 10000; // 10s before expiration
  access_token[isSyncSecret ? 'sync' : 'normal'] = {
    value: data.access_token,
    expire
  };
  return data.access_token;
}

export const wecom_redirectFn: RedirectFn = async ({ req, redirect_uri, state }) => {
  const isWecomWorkTerminal = req.query.isWecomWorkTerminal as '1' | '0';
  const corpid = process.env.WECOM_CORPID || '';
  const agentid = process.env.WECOM_AGENTID || '';
  if (isWecomWorkTerminal === '1') {
    const url = new URL(wecomTargetURLOAuth);
    url.searchParams.set('appid', corpid);
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', 'snsapi_privateinfo');
    url.searchParams.set('agentid', agentid);
    url.searchParams.set('state', state);
    return { redirectUrl: url.toString() + '#wechat_redirect' };
  } else {
    const url = new URL(wecomTargetURLSSO);
    url.searchParams.set('login_type', 'CorpApp');
    url.searchParams.set('appid', corpid);
    url.searchParams.set('agentid', agentid);
    url.searchParams.set('redirect_uri', redirect_uri);
    url.searchParams.set('state', state);
    return { redirectUrl: url.toString() };
  }
};

export const wecom_getUserInfo: GetUserInfoFn = async (code: string) => {
  if (!corpid || !agentid) {
    throw new Error('corpid or agentid is required');
  }

  // 1. get access_token
  const access_token = await getAccessToken({
    corpid,
    secret: appSecret
  });

  // 2. get userid
  const userIdResponse = await axios.get(getUserIdURL, {
    params: {
      code,
      access_token
    }
  });

  const { userid, user_ticket, errmsg } = userIdResponse.data;
  if (!userid) {
    throw new Error(errmsg || 'Fail to get wecom userid');
  }

  // 3. get userInfo
  const userInfoURL = new URL(getUserDetailURL);
  userInfoURL.searchParams.set('access_token', access_token);

  const userInfoResponse = await axios.post(userInfoURL.toString(), {
    user_ticket
  });

  const userDetail = userInfoResponse.data;

  // 4. get username
  const usernameURL = new URL(getUserInfoURL);
  usernameURL.searchParams.set('access_token', access_token);
  usernameURL.searchParams.set('userid', userid);

  const usernameResponse = await axios.get(usernameURL.toString());
  const { name } = usernameResponse.data;

  return {
    username: `${UserPrefix.WECOM}-${userid}`,
    contact: userDetail.mobile || userDetail.email || '',
    avatar: userDetail.avatar || '',
    memberName: name
  };
};
export const wecom_getOrgList: GetOrgListFn = async () => {
  const access_token = await getAccessToken({ corpid, secret: appSecret });
  const orgList: OrgListType = [];

  const { data } = await axios.request<{
    errcode: number;
    errmsg: string;
    department: Array<{
      id: string;
      name: string;
      parentid: string;
    }>;
  }>({
    url: getDepartmentListURL,
    method: 'GET',
    params: { access_token }
  });
  if (data.errcode !== 0) {
    throw new Error(`API Error: ${data.errmsg} (code: ${data.errcode})`);
  }
  data.department.forEach((dept) => {
    orgList.push({
      id: dept.id,
      name: dept.name,
      parentId: dept.parentid || ''
    });
  });

  return orgList;
};

export const wecom_getUserList: GetUserListFn = async () => {
  const access_token = await getAccessToken({ corpid, secret: syncSecret, isSyncSecret: true });
  const userIdAndDeparmentList = [];
  let nextCursor = '';

  do {
    const params: any = { access_token };
    if (nextCursor) {
      params.cursor = nextCursor;
    }
    const { data } = await axios.request<{
      errcode: number;
      errmsg: string;
      next_cursor: string;
      dept_user: Array<{
        userid: string;
        department: string;
      }>;
    }>({
      url: getUserListURL,
      method: 'POST',
      params
    });

    if (data.errcode !== 0) {
      throw new Error(`API Error: ${data.errmsg} (code: ${data.errcode})`);
    }

    userIdAndDeparmentList.push(...data.dept_user);
    nextCursor = data.next_cursor;
  } while (nextCursor);

  // 构建用户 ID 到部门列表的映射
  const userMap = (() => {
    const userMap = new Map<string, string[]>();
    for (const user of userIdAndDeparmentList) {
      const department = user.department;
      if (!userMap.has(user.userid)) {
        userMap.set(user.userid, []);
      }
      userMap.get(user.userid)!.push(department);
    }
    return userMap;
  })();

  return Array.from(userMap.entries()).map(([userid, departments]) => ({
    username: `${UserPrefix.WECOM}-${userid}`,
    memberName: `${UserPrefix.WECOM}-${userid}`,
    orgs: departments
  }));
};
