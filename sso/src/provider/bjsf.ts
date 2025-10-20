import { promises } from 'fs';
import { AssertFn, GetUserInfoFn, RedirectFn } from '../type';
import { Profile, SAML } from '@node-saml/node-saml';
import { getTmpValue, setTmpValue } from '../global';
import axios from 'axios';
import { parseIDPMetadataFromString } from 'metadata-saml2';
import { getErrText } from '../utils';

let saml: SAML;
let spCert: string;

export const init_bjsf = async () => {
  spCert = (await promises.readFile(process.env.BJSF_SP_CERT_PATH ?? 'sp.crt')).toString();
  const spKey = (await promises.readFile(process.env.BJSF_SP_KEY_PATH ?? 'sp.key')).toString();

  let idpCert: string | string[] = '';
  if (process.env.BJSF_IDP_CERT_PATH) {
    idpCert = (await promises.readFile(process.env.BJSF_IDP_CERT_PATH)).toString();
  }
  const hostname = process.env.HOSTNAME;
  let entryPoint = process.env.SSO_TARGET_URL;
  const metadataUrl = process.env.BJSF_IDP_METADATA_URL;

  if (!hostname) {
    throw new Error('Please set HOSTNAME in environment variable');
  }
  if (!entryPoint && !metadataUrl) {
    throw new Error('Please set SSO_TARGET_URL or BJSF_IDP_METADATA_URL in environment variable');
  }
  if (!idpCert && !metadataUrl) {
    throw new Error(
      'Please set BJSF_IDP_CERT_PATH or BJSF_IDP_METADATA_URL in environment variable'
    );
  }

  if (metadataUrl) {
    const { data } = await axios.get<string>(metadataUrl);
    console.log('raw metadata:\n', data);
    const metadata = await parseIDPMetadataFromString(data);
    console.log('metadata', metadata);
    if (metadata.X509Certificates && metadata.X509Certificates.length > 0) {
      idpCert = metadata.X509Certificates;
    }
    if (metadata.HTTPPost && metadata.HTTPPost.length > 0) {
      entryPoint = metadata.HTTPPost;
    }
  }

  console.log('idpCert & entryPoint:\n', idpCert, entryPoint);

  saml = new SAML({
    callbackUrl: `${hostname}/login/saml/assert`,
    issuer: `${hostname}/login/saml/metadata.xml`,
    idpCert: idpCert,
    publicCert: spCert,
    privateKey: spKey,
    entryPoint: entryPoint,
    authnRequestBinding: 'HTTP-POST',
    signatureAlgorithm: 'sha256',
    digestAlgorithm: 'sha256',
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
    racComparison: 'minimum',
    wantAuthnResponseSigned: false,
    authnContext: [
      'urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport',
      'urn:oasis:names:tc:SAML:2.0:ac:classes:Password',
      'urn:oasis:names:tc:SAML:2.0:ac:classes:X509'
    ]
  });
  console.log('saml', saml);
};

export const bjsf_getMetadata = async () => {
  return saml.generateServiceProviderMetadata(null, spCert);
};

export const bjsf_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  // add redirect_uri to state
  const newState = `${state ?? ''}&redirect_uri=${redirect_uri}`;
  const url = await saml.getAuthorizeUrlAsync(newState, undefined, {});
  return { redirectUrl: url };
};

export const bjsf_assertFn: AssertFn = async (data) => {
  const { RelayState } = data;
  if (!RelayState) {
    Promise.reject(new Error('RelayState is required'));
  }
  // get redirect_uri from state
  const [state, redirect_uri] = RelayState.split('&redirect_uri=');
  console.log('assert data', data);
  try {
    const { profile, loggedOut } = await saml.validatePostResponseAsync(data);
    if (loggedOut || !profile) {
      return Promise.reject(new Error('Logged out or got null profile'));
    }

    const code = Math.random().toString(36).slice(-8);
    setTmpValue(code, profile, 5);

    const url = new URL(redirect_uri);
    url.searchParams.append('code', code);
    url.searchParams.append('state', state);
    return { redirectUrl: url.toString() };
  } catch (error) {
    const msg = getErrText(error);
    if (msg === 'SAML assertion not yet valid') {
      // wait for 2s and retry
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return bjsf_assertFn(data);
    } else {
      return Promise.reject(error);
    }
  }
  return Promise.reject(new Error('Invalid SAML response'));
};

export const bjsf_getUserInfo: GetUserInfoFn = async (code: string) => {
  const profile = getTmpValue<Profile>(code);
  if (!profile) {
    return Promise.reject(new Error('Invalid code'));
  }
  console.log('profile', profile);
  const username = (profile['名称ID'] as string) ?? profile.nameID;
  if (!username) {
    return Promise.reject(new Error('Invalid profile: blank nameID'));
  }
  return {
    username,
    avatar: '',
    contact: profile.email ?? ''
  };
};
