import { bjsf_assertFn, bjsf_getMetadata, bjsf_getUserInfo, bjsf_redirectFn } from './bjsf';
import { TCL_getUserInfo, tcl_redirectFn } from './tcl';
import {
  testSaml_assertFn,
  testSaml_getMetadata,
  testSaml_getUserInfo,
  testSaml_redirectFn
} from './testSaml';
import type {
  AssertFn,
  CallbackFn,
  GetMetaDataFn,
  GetOrgListFn,
  GetUserInfoFn,
  GetUserListFn,
  RedirectFn
} from '../type';
import { aecc_callbackFn, aecc_getUserInfo, aecc_redirectFn } from './aecc';
import { dingtalk_getUserInfo, dingtalk_redirectFn } from './dingtalk';
import {
  feishu_getOrgList,
  feishu_getUserInfo,
  feishu_getUserList,
  feishu_redirectFn
} from './feishu';
import { hebamr_getUserInfo, hebamr_redirectFn } from './hebamr';
import { leapmotor_getUserInfo, leapmotor_redirectFn } from './leapmotor';
import { oauth2_getUserInfo, oauth2_redirectFn } from './oauth2';
import {
  stressTest_getOrgList,
  stressTest_getUserInfo,
  stressTest_GetUserList,
  stressTest_redirectFn
} from './stressTest';
import { test_getUserInfo, test_redirectFn } from './test';
import { wecom_getOrgList, wecom_getUserInfo, wecom_getUserList, wecom_redirectFn } from './wecom';
import {
  jintian_getOrgList,
  jintian_getUserInfo,
  jintian_getUserList,
  jintian_redirectFn
} from './jintian';

import { qilu_getOrgList, qilu_getUserInfo, qilu_redirectFn, qilu_getUserList } from './qilu';
import { mrl_getUserInfo, mrl_redirectFn } from './mrl';
import { hk_getUserInfo, hk_redirectFn,hk_getOrgList,hk_getUserList } from './hk';
import { gacc_getOrgList,gacc_getUserInfo,gacc_getUserList,gacc_redirectFn } from './gacc';
const providerMap: {
  [key: string]: {
    getUserInfo: GetUserInfoFn;
    redirectFn: RedirectFn;
    callbackFn?: CallbackFn;
    getMetaData?: GetMetaDataFn;
    assertFn?: AssertFn;
    getUserList?: GetUserListFn;
    getOrgList?: GetOrgListFn;
  };
} = {
  test: {
    redirectFn: test_redirectFn,
    getUserInfo: test_getUserInfo
  },
  testSaml: {
    redirectFn: testSaml_redirectFn,
    getUserInfo: testSaml_getUserInfo,
    getMetaData: testSaml_getMetadata,
    assertFn: testSaml_assertFn
  },
  leapmotor: {
    redirectFn: leapmotor_redirectFn,
    getUserInfo: leapmotor_getUserInfo
  },
  aecc: {
    redirectFn: aecc_redirectFn,
    callbackFn: aecc_callbackFn,
    getUserInfo: aecc_getUserInfo
  },
  hebamr: {
    redirectFn: hebamr_redirectFn,
    getUserInfo: hebamr_getUserInfo
  },
  bjsf: {
    redirectFn: bjsf_redirectFn,
    getUserInfo: bjsf_getUserInfo,
    getMetaData: bjsf_getMetadata,
    assertFn: bjsf_assertFn
  },
  tcl: {
    redirectFn: tcl_redirectFn,
    getUserInfo: TCL_getUserInfo
  },
  feishu: {
    redirectFn: feishu_redirectFn,
    getUserInfo: feishu_getUserInfo,
    getUserList: feishu_getUserList,
    getOrgList: feishu_getOrgList
  },
  wecom: {
    redirectFn: wecom_redirectFn,
    getUserInfo: wecom_getUserInfo,
    getUserList: wecom_getUserList,
    getOrgList: wecom_getOrgList
  },
  dingtalk: {
    redirectFn: dingtalk_redirectFn,
    getUserInfo: dingtalk_getUserInfo
  },
  oauth2: {
    redirectFn: oauth2_redirectFn,
    getUserInfo: oauth2_getUserInfo
  },
  stressTest: {
    redirectFn: stressTest_redirectFn,
    getUserInfo: stressTest_getUserInfo,
    getUserList: stressTest_GetUserList,
    getOrgList: stressTest_getOrgList
  },
  jintian: {
    redirectFn: jintian_redirectFn,
    getUserInfo: jintian_getUserInfo,
    getUserList: jintian_getUserList,
    getOrgList: jintian_getOrgList
  },
  qilu: {
    redirectFn: qilu_redirectFn,
    getUserInfo: qilu_getUserInfo,
    getUserList: qilu_getUserList,
    getOrgList: qilu_getOrgList
  },
  mrl: {
    getUserInfo: mrl_getUserInfo,
    redirectFn: mrl_redirectFn
  },
  hk:{
    getUserInfo: hk_getUserInfo,
    redirectFn: hk_redirectFn,
    getUserList: hk_getUserList,
    getOrgList: hk_getOrgList
  },
  gacc:{
    getUserInfo:gacc_getUserInfo,
    getUserList:gacc_getUserList,
    getOrgList:gacc_getOrgList,
    redirectFn:gacc_redirectFn
  }
};

export function getProvider() {
  const provider = process.env.SSO_PROVIDER as keyof typeof providerMap;
  if (!providerMap[provider]) {
    return false;
  }
  return providerMap[provider];
}
