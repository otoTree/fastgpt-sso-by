import {
  RedirectFn,
  GetUserInfoFn,
  UserListType,
  OrgListType,
  GetUserListFn,
  GetOrgListFn
} from '../type';
import axios from 'axios';
import { UserPrefix } from '../userPrefix';

type AccessToken = {
  value: string;
  expire: number;
};

let access_token: { sync?: AccessToken; normal?: AccessToken } = {};
let pendingToken: { sync?: Promise<string>; normal?: Promise<string> } = {};

async function getAccessToken({
  app_id,
  app_secret,
  isSyncSecret
}: {
  app_id: string;
  app_secret: string;
  isSyncSecret?: boolean;
}) {
  const key = isSyncSecret ? 'sync' : 'normal';
  const currentToken = access_token[key];

  if (currentToken && currentToken.expire > Date.now()) {
    return currentToken.value;
  }

  if (pendingToken[key]) {
    return pendingToken[key];
  }

  try {
    pendingToken[key] = (async () => {
      const { data } = await axios.request<{
        code: number;
        msg: string;
        tenant_access_token: string;
        expires: number;
      }>({
        url: 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
        method: 'POST',
        data: { app_id, app_secret }
      });

      if (data.code !== 0) {
        throw new Error(`获取 Token 失败: ${data.msg} (code: ${data.code})`);
      }

      // 计算过期时间（提前 10 秒刷新）
      const expire = Date.now() + data.expires * 1000 - 10000;
      access_token[key] = {
        value: data.tenant_access_token,
        expire
      };

      return data.tenant_access_token;
    })();

    return await pendingToken[key];
  } finally {
    pendingToken[key] = undefined; // 请求完成后清除 pending 状态
  }
}

export const feishu_getUserList: GetUserListFn = async () => {
  const app_id = process.env.FEISHU_APP_ID || '';
  const app_secret = process.env.FEISHU_APP_SECRET || '';
  const access_token = await getAccessToken({ app_id, app_secret, isSyncSecret: true });
  const result: UserListType = [];
  let pageToken: string | undefined;

  do {
    const { data } = await axios.request<{
      code: number;
      msg: string;
      data: {
        has_more: boolean;
        page_token?: string;
        items: Array<{
          user_id: string;
          name: string;
          name_zh?: string;
          en_name?: string;
          avatar?: {
            avatar_origin?: string;
          };
          email?: string;
          mobile?: string;
          department_ids: string[];
        }>;
      };
    }>({
      url: 'https://open.feishu.cn/open-apis/contact/v3/users/find_by_department',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      params: {
        department_id: 0,
        department_id_type: 'open_department_id',
        page_size: 50,
        page_token: pageToken,
        user_id_type: 'open_id'
      }
    });

    if (data.code !== 0) {
      throw new Error(`API Error: ${data.msg} (code: ${data.code})`);
    }

    result.push(
      ...data.data.items.map((user) => ({
        username: `${UserPrefix.FEISHU}-${user.user_id}`,
        memberName: user.name_zh || user.en_name || `${UserPrefix.FEISHU}-${user.user_id}`,
        avatar: user.avatar?.avatar_origin,
        contact: user.email || user.mobile || undefined,
        orgs: user.department_ids.map((id) => (id === '0' ? 'feishu-0' : id))
      }))
    );

    pageToken = data.data.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  return result;
};

export const feishu_getOrgList: GetOrgListFn = async () => {
  const app_id = process.env.FEISHU_APP_ID || '';
  const app_secret = process.env.FEISHU_APP_SECRET || '';
  const access_token = await getAccessToken({ app_id, app_secret, isSyncSecret: true });
  const orgList: OrgListType = [];
  let pageToken: string | undefined;

  do {
    const { data } = await axios.request<{
      code: number;
      msg: string;
      data: {
        has_more: boolean;
        page_token?: string;
        items: Array<{
          name: string;
          i18n_name?: { zh_cn?: string };
          open_department_id: string;
          parent_department_id: string;
        }>;
      };
    }>({
      url: `https://open.feishu.cn/open-apis/contact/v3/departments/0/children`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${access_token}`
      },
      params: {
        department_id_type: 'open_department_id',
        user_id_type: 'open_id',
        fetch_child: true,
        page_size: 50,
        page_token: pageToken
      }
    });

    if (data.code !== 0) {
      throw new Error(`API Error: ${data.msg} (code: ${data.code})`);
    }

    data.data.items.forEach((dept) => {
      orgList.push({
        id: `${dept.open_department_id}`,
        name: dept.i18n_name?.zh_cn || dept.name || '未命名部门',
        parentId: dept.parent_department_id === '0' ? 'feishu-0' : dept.parent_department_id
      });
    });

    pageToken = data.data.has_more ? data.data.page_token : undefined;
  } while (pageToken);

  orgList.push({
    id: 'feishu-0',
    name: '虚拟根部门',
    parentId: ''
  });

  return orgList;
};

export const feishu_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  const targetUrl =
    process.env.SSO_TARGET_URL || 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
  const appId = process.env.FEISHU_APP_ID || '';
  const url = new URL(targetUrl);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  return { redirectUrl: url.toString() };
};

export const feishu_getUserInfo: GetUserInfoFn = async (code: string) => {
  const getUserInfoUrl =
    process.env.FEISHU_GET_USER_INFO_URL || 'https://open.feishu.cn/open-apis/authen/v1/user_info';
  const app_id = process.env.FEISHU_APP_ID || '';
  const app_secret = process.env.FEISHU_APP_SECRET || '';
  const token_url =
    process.env.FEISHU_TOKEN_URL || 'https://open.feishu.cn/open-apis/authen/v2/oauth/token';
  const redirect_uri =
    process.env.FEISHU_REDIRECT_URI || 'http://localhost:3030/login/oauth/access_token';

  const { data: tokenData } = await axios.post(token_url, {
    grant_type: 'authorization_code',
    client_id: app_id,
    client_secret: app_secret,
    redirect_uri: redirect_uri,
    code: code
  });

  const accessToken = tokenData.access_token;

  const { data: userData } = await axios.get(getUserInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  return {
    username: `${UserPrefix.FEISHU}-${userData.data.open_id}` || '',
    avatar: userData.data.avatar_url || '',
    contact: userData.data.email || '',
    memberName: userData.data.name || ''
  };
};
