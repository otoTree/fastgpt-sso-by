import axios from 'axios';
import xml2js from 'xml2js';
import { RedirectFn, GetUserInfoFn, CallbackFn } from '../type';
import { getTmpValue, setTmpValue } from '../global';
import { Request } from 'express';

const global = globalThis as typeof globalThis & {
  aecc_redirect_uri: string | undefined;
};

const getService = (req: Request) =>
  new URL(`${req.protocol}://${req.get('host')}/login/oauth/callback`);

export const aecc_redirectFn: RedirectFn = async ({ req, redirect_uri }) => {
  const service = getService(req);

  // 缓存 redirect_uri，用于二次跳转
  global.aecc_redirect_uri = redirect_uri;
  // Target URL e.g. http://example.com/CAS/login
  const targetUrl = process.env.SSO_TARGET_URL as string;
  const url = new URL(targetUrl);
  url.searchParams.set('service', service.toString());

  return { redirectUrl: url.toString() };
};

export const aecc_callbackFn: CallbackFn = async ({ req }) => {
  const { ticket } = req.query as { ticket: string };
  const service = getService(req);

  if (!ticket) {
    return Promise.reject('Invalid ticket');
  }
  const redirect_uri = global.aecc_redirect_uri;
  if (!redirect_uri) {
    return Promise.reject('Invalid redirect_uri');
  }
  // 二次跳转
  const url = `${redirect_uri}?code=${ticket}`;

  setTmpValue(ticket, service.toString());

  return { redirectUrl: url };
};

function test() {
  const data =
    "\n\n<cas:serviceResponse xmlns:cas='http://www.yale.edu/tp/cas'>\n\t<cas:authenticationSuccess>\n\t\t<cas:user>59800978</cas:user>\n\t\t\n\t\t \n\n\t\t\t\n\t\t\n\n\n\t</cas:authenticationSuccess>\n</cas:serviceResponse>";
  const parser = new xml2js.Parser();
  parser.parseStringPromise(data).then((result) => {
    const user = result['cas:serviceResponse']['cas:authenticationSuccess'][0]['cas:user'][0];
    console.log(result, user);
  });
}

export const aecc_getUserInfo: GetUserInfoFn = async (code: string) => {
  const validateUrl = process.env.AECC_SERVICE_VALIDATE_URL as string;
  const service = getTmpValue<string>(code);
  if (!service) {
    return Promise.reject('Invalid code');
  }

  try {
    const { data } = await axios.get(validateUrl, {
      params: {
        ticket: code,
        service: service
      }
    });

    console.log('got response: ', { data });

    const parser = new xml2js.Parser();
    const result = await parser.parseStringPromise(data);

    const user = result['cas:serviceResponse']['cas:authenticationSuccess'][0]['cas:user'][0];
    if (!user) {
      return Promise.reject('Verify failed, got empty user in response');
    }

    return {
      username: user,
      avatar: '',
      contact: ''
    };
  } catch (e) {
    console.error('Unable to varify the code', e);
    return Promise.reject('Verify failed, due to bad response');
  }
};
