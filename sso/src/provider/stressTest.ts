import { GetOrgListFn, GetUserInfoFn, GetUserListFn, RedirectFn } from '../type';

// 用于存储生成的code和对应的用户信息
const codeMap = new Map();

export const stressTest_redirectFn: RedirectFn = async ({ redirect_uri, state }) => {
  // 生成随机 code
  const code = Math.random().toString(36).substring(2, 15);

  // 存储 code 对应的模拟用户信息
  codeMap.set(code, {
    username: 'test-user1234',
    contact: '15677751111'
  });

  const redirectUrl = `${redirect_uri}?code=${code}${state ? `&state=${state}` : ''}`;
  console.log(redirectUrl);

  return { redirectUrl };
};

export const stressTest_getUserInfo: GetUserInfoFn = async (code: string) => {
  // 获取存储的用户信息
  const userInfo = codeMap.get(code);
  console.log(userInfo, code);
  if (!userInfo) {
    return Promise.reject('Invalid code');
  }

  // 使用完后删除 code
  codeMap.delete(code);

  return userInfo;
};

export const stressTest_GetUserList: GetUserListFn = async () => {
  return Promise.resolve(
    Array.from({ length: 30000 }).map((_, i) => ({
      username: `test-user${i}`,
      contact: '15677751111',
      memberName: `test-user${i}`,
      orgs: ['1', '2', '3', '4', '5'].sort(() => 0.5 - Math.random()).slice(0, 4)
    }))
  );
};

export const stressTest_getOrgList: GetOrgListFn = async () => {
  return [
    {
      id: '1',
      name: '社区管理',
      parentId: ''
    },
    {
      id: '2',
      name: '1-2',
      parentId: '1'
    },
    {
      id: '3',
      name: '1-2-3',
      parentId: '2'
    },
    {
      id: '4',
      name: '4',
      parentId: '1'
    },
    {
      id: '5',
      name: '5',
      parentId: '4'
    }
  ];
};
