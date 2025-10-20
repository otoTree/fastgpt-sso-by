import { promises } from 'fs';
import { AssertFn, GetUserInfoFn, RedirectFn } from '../type';
import { Profile, SAML } from '@node-saml/node-saml';
import { getTmpValue, setTmpValue } from '../global';
import axios from 'axios';
import { parseIDPMetadataFromString } from 'metadata-saml2';

let saml: SAML;
let spCert: string;

export const initTestSaml = async () => {
  spCert = (await promises.readFile(process.env.TEST_SAML_SP_CERT_PATH ?? 'sp.crt')).toString();
  const spKey = (await promises.readFile(process.env.TEST_SAML_SP_KEY_PATH ?? 'sp.key')).toString();
  let idpCert: string | string[] = (
    await promises.readFile(process.env.TEST_SAML_IDP_CERT_PATH ?? 'idp.crt')
  ).toString();
  const hostname = process.env.HOSTNAME;
  let entryPoint = process.env.SSO_TARGET_URL;
  const metadataUrl = process.env.TEST_SAML_IDP_METADATA_URL;

  if (!hostname) {
    throw new Error('Please set HOSTNAME in environment variable');
  }
  if (!entryPoint) {
    throw new Error('Please set SSO_TARGET_URL in environment variable');
  }

  if (metadataUrl) {
    const { data } = await axios.get<string>(metadataUrl);
    const metadata = await parseIDPMetadataFromString(data);
    console.log('metadata', metadata);
    if (metadata.X509Certificates && metadata.X509Certificates.length > 0) {
      idpCert = metadata.X509Certificates;
    }
    if (metadata.HTTPPost && metadata.HTTPPost.length > 0) {
      entryPoint = metadata.HTTPPost;
    }
  }

  saml = new SAML({
    callbackUrl: `${hostname}/login/saml/assert`,
    issuer: `${hostname}/login/saml/metadata.xml`,
    idpCert: idpCert,
    publicCert: spCert,
    privateKey: spKey,
    entryPoint: entryPoint,
    authnRequestBinding: 'HTTP-POST',
    identifierFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'
  });
};

export const testSaml_getMetadata = async () => {
  return saml.generateServiceProviderMetadata(null, spCert);
};

export const testSaml_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  // add redirect_uri to state
  const newState = `${state ?? ''}&redirect_uri=${redirect_uri}`;
  const url = await saml.getAuthorizeUrlAsync(newState, undefined, {});
  return { redirectUrl: url };
};

export const testSaml_assertFn: AssertFn = async (data) => {
  const { RelayState } = data;
  if (!RelayState) {
    Promise.reject(new Error('RelayState is required'));
  }
  // get redirect_uri from state
  const [state, redirect_uri] = RelayState.split('&redirect_uri=');
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
};

export const testSaml_getUserInfo: GetUserInfoFn = async (code: string) => {
  const profile = getTmpValue<Profile>(code);
  if (!profile) {
    return Promise.reject(new Error('Invalid code'));
  }
  console.log('profile', profile);
  return {
    username: profile.nameID,
    avatar: '',
    contact: profile.email ?? ''
  };
};
