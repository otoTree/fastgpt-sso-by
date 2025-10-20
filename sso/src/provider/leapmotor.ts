import { RedirectFn, GetUserInfoFn } from '../type';
import axios from 'axios';

export const leapmotor_redirectFn: RedirectFn = async ({ state }) => {
  const targetUrl = process.env.SSO_TARGET_URL as string;

  // 解析 redirect_uri，然后给他带上 state，redirect_uri本身可能已经是带参数的
  const url = new URL(targetUrl);
  url.searchParams.set('state', state);
  const redirectUrl = url.toString();

  return { redirectUrl };
};

export const leapmotor_getUserInfo: GetUserInfoFn = async (code: string) => {
  const AUTH_URL = process.env.LEAPMOTOR_AUTH_URL as string;
  const GET_USER_INFO_URL = process.env.LEAPMOTOR_GET_USER_INFO_URL as string;
  const CLIENT_ID = process.env.LEAPMOTOR_CLIENT_ID as string;
  const CLIENT_SECRET = process.env.LEAPMOTOR_CLIENT_SECRET as string;
  const REDIRECT_URI = process.env.LEAPMOTOR_REDIRECT_URI as string;

  const { data } = await axios.request({
    url: AUTH_URL,
    method: 'get',
    params: {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }
  });
  const access_token = data.access_token;
  const { data: userInfo } = await axios.request({
    url: GET_USER_INFO_URL,
    method: 'get',
    headers: {
      Authorization: `Bearer ${access_token}`
    }
  });

  return {
    username: userInfo.data.jobNumber,
    avatar: '',
    contact: userInfo.data.email
  };
};
