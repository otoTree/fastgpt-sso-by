import { RedirectFn, GetUserInfoFn } from '../type';
import axios from 'axios';

export const tcl_redirectFn: RedirectFn = async ({ state }) => {
  const targetUrl = process.env.SSO_TARGET_URL as string;

  // 解析 redirect_uri，然后给他带上 state，redirect_uri本身可能已经是带参数的
  const url = new URL(targetUrl);
  // url.searchParams.set('state', state);
  const redirectUrl = url.toString();

  return { redirectUrl };
};

export const TCL_getUserInfo: GetUserInfoFn = async (code: string) => {
  const TOKENURL = process.env.TCL_TOKEN_URL as string;
  const GET_USER_INFO_URL = process.env.TCL_GET_USER_INFO_URL as string;
  const CLIENT_ID = process.env.TCL_CLIENT_ID as string;
  const CLIENT_SECRET = process.env.TCL_CLIENT_SECRET as string;
  const REDIRECT_URI = process.env.TCL_REDIRECT_URI as string;

  const { data } = await axios.request({
    url: TOKENURL,
    method: 'post',
    params: {
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI
    }
  });

  // ret: access_token=xxxxx&expires_in=
  const access_token = data.split('&')[0].split('=')[1];
  const { data: userInfo } = await axios.request<{
    id: string;
    attributes: any;
  }>({
    url: GET_USER_INFO_URL,
    method: 'get',
    params: {
      access_token
    }
  });
  // userInfo return sample:
  // {
  //   "attributes": [
  //     {
  //       "uid": "38753"
  //     },
  //     {
  //       "smart-type": "E1"
  //     },
  //     {
  //       "smart-csot-loginname": "zhoushuchang"
  //     },
  //     {
  //       "mail": "zhoushuchang@tcl.com"
  //     },
  //     {
  //       "mobile": "1336548141"
  //     }
  //   ],
  //   "id": "38753"
  // }
  const uid = userInfo.attributes.find((item: any) => Object.keys(item).includes('uid')).uid;
  const mobile = userInfo.attributes.find((item: any) =>
    Object.keys(item).includes('mobile')
  ).mobile;
  const mail = userInfo.attributes.find((item: any) => Object.keys(item).includes('mail')).mail;

  return {
    username: 'tcl-' + uid,
    avatar: '',
    contact: mobile || mail
  };
};
