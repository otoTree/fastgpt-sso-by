import { RedirectFn, GetUserInfoFn } from '../type';
import axios from 'axios';
import { UserPrefix } from '../userPrefix';

export const dingtalk_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  const targetUrl = process.env.SSO_TARGET_URL || 'https://login.dingtalk.com/oauth2/auth';
  const client_id = process.env.DINGTALK_CLIENT_ID || '';
  const url = new URL(targetUrl);
  url.searchParams.set('client_id', client_id);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('state', state);
  url.searchParams.set('scope', 'openid');
  url.searchParams.set('prompt', 'consent');
  return { redirectUrl: url.toString() };
};

export const dingtalk_getUserInfo: GetUserInfoFn = async (code: string) => {
  const token_url =
    process.env.DINGTALK_TOKEN_URL || 'https://api.dingtalk.com/v1.0/oauth2/userAccessToken';
  const client_id = process.env.DINGTALK_CLIENT_ID || '';
  const client_secret = process.env.DINGTALK_CLIENT_SECRET || '';
  const getUserInfoUrl =
    process.env.DINGTALK_GET_USER_INFO_URL || 'https://api.dingtalk.com/v1.0/contact/users/me';

  const { data: tokenData } = await axios.post(token_url, {
    clientId: client_id,
    clientSecret: client_secret,
    code,
    grantType: 'authorization_code'
  });

  if (!tokenData.accessToken) {
    throw new Error('Fail to get dingtalk access token');
  }

  const { data: userData } = await axios.get(getUserInfoUrl, {
    headers: {
      'x-acs-dingtalk-access-token': tokenData.accessToken
    }
  });

  return {
    username: `${UserPrefix.DINGTALK}-${userData.openId}` || '',
    avatar: userData.avatarUrl || '',
    contact: userData.mobile || userData.email || '',
    memberName: userData.nick || ''
  };
};
