import { RedirectFn, GetUserInfoFn, OrgListType, GetUserListFn, GetOrgListFn } from '../type';
import axios from 'axios';
import { UserPrefix } from '../userPrefix';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
// jwt密钥
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
// 齐鲁制药IAM系统接口地址
//const qiluIamBaseURL = process.env.QILU_IAM_BASE_URL || 'http://172.17.12.66:9000/baseservice-1.0';
const qiluLoginURL =
  process.env.QILU_IAM_URL ||
  'http://172.17.12.66:9000/baseservice-1.0/iamToDownStream/authLoginlam';
const qiluSystemCode = process.env.QILU_SYSTEM_CODE || 'JCBZH';

// 齐鲁制药IAM登录跳转URL
const qiluRedirectURL = process.env.QILU_REDIRECT_URL || 'https://iam.qilu.com/login';

// 齐鲁制药数据库配置
const qiluDbConfig = {
  host: process.env.QILU_DB_HOST || '172.17.4.208',
  port: parseInt(process.env.QILU_DB_PORT || '3306'),
  user: process.env.QILU_DB_USER || 'stcx',
  password: process.env.QILU_DB_PASSWORD || 'fUR%0Imq9&PhI#YN',
  database: process.env.QILU_DB_NAME || 'bim'
};

// 创建数据库连接
const createDbConnection = async () => {
  return await mysql.createConnection(qiluDbConfig);
};

// 齐鲁制药IAM接口响应类型
type QiluIamResponse<T = any> = {
  code: number;
  msg: string;
  data: T;
};

// 齐鲁制药用户信息类型
type QiluUserInfo = {
  userCode: string;
  userName: string;
  orgCode: string;
};

export const qilu_redirectFn: RedirectFn = async ({ req, redirect_uri, state }) => {
  // 构建齐鲁制药IAM登录跳转URL
  const url = new URL(qiluRedirectURL);
  url.searchParams.set('redirect_uri', redirect_uri);
  url.searchParams.set('state', state);
  url.searchParams.set('systemCode', qiluSystemCode);

  return { redirectUrl: url.toString() };
};

export const qilu_getUserInfo: GetUserInfoFn = async (code: string) => {
  if (!code) {
    throw new Error('code is required');
  }

  console.log('code: ', code);

  try {
    // 解密JWT token
    console.log('[qilu_getUserInfo] 尝试JWT解密');
    const decoded = jwt.verify(code, JWT_SECRET, {
      algorithms: ['HS256']
    }) as { username: string };
    const username_decoded = decoded.username;
    console.log('[qilu_getUserInfo] JWT解密成功:', { username_decoded });

    return {
      username: `${UserPrefix.QILU}-${username_decoded}`,
      contact: '',
      avatar: '',
    };
  } catch (error) {
    console.error('[qilu_getUserInfo] JWT解密失败:', error);
    console.log('开始进行iam登录');
    // 调用齐鲁制药IAM接口获取用户信息
    const response = await axios.post<QiluIamResponse<QiluUserInfo>>(
      qiluLoginURL,
      {
        code,
        systemCode: qiluSystemCode
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('response: ', response);

    const { code: responseCode, msg, data } = response.data;

    // 检查响应状态
    if (responseCode !== 0) {
      throw new Error(msg || 'Failed to get user info from Qilu IAM');
    }

    if (!data || !data.userCode) {
      throw new Error('Invalid user data from Qilu IAM');
    }

    return {
      username: `${UserPrefix.QILU}-${data.userCode}`,
      contact: '',
      avatar: '',
      memberName: data.userName
    };
  }
};

export const qilu_getOrgList: GetOrgListFn = async () => {
  let connection;
  try {
    connection = await createDbConnection();

    // 查询组织架构数据
    const [rows] = await connection.execute(`
      SELECT 
        SORG_CODE as id,
        SORG_NAME as name,
        SORG_PARENT_CODE as parentId
      FROM iam_zzst 
      WHERE SORG_IS_DISABLED = 0
      ORDER BY SORG_DISPLAY_PATH
    `);

    const dbOrgList: OrgListType = (rows as any[]).map((row) => ({
      id: String(row.id || ''),
      name: String(row.name || ''),
      parentId: row.parentId ? String(row.parentId) : '' // 处理null值，null表示根节点
    }));

    // 创建虚拟根组织
    const virtualRootOrg = {
      id: 'virtual-root',
      name: '齐鲁制药',
      parentId: ''
    };

    // 将所有没有父组织的组织设置为虚拟根组织的子组织
    const processedOrgList = dbOrgList.map((org) => {
      if (org.parentId === '') {
        return {
          ...org,
          parentId: 'virtual-root'
        };
      }
      return org;
    });

    // 将虚拟根组织添加到列表开头
    const orgList: OrgListType = [virtualRootOrg, ...processedOrgList];

    // 打印前10行数据用于调试
    console.log('组织架构数据前10行:', JSON.stringify(orgList.slice(0, 10), null, 2));

    return orgList;
  } catch (error) {
    console.error('Failed to fetch org list from Qilu database:', error);
    throw new Error('Failed to fetch organization list');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

export const qilu_getUserList: GetUserListFn = async () => {
  let connection;
  try {
    connection = await createDbConnection();

    // 查询用户数据
    const [rows] = await connection.execute(`
      SELECT 
        SUSR_USERNAME as userCode,
        SUSR_FULLNAME as userName,
        SUSR_EMAIL as email,
        SUSR_MOBILE as mobile,
        SORG_CODE as orgCode,
        SORG_NAME as orgName,
        SORG_DISPLAY_PATH as orgPath
      FROM iam_ryst 
      WHERE SUSR_IS_DISABLED = 0
      ORDER BY SUSR_USERNAME
    `);

    const userList = (rows as any[]).map((row) => ({
      username: `${UserPrefix.QILU}-${String(row.userCode)}`,
      memberName: String(row.userName || row.userCode),
      avatar: '', // 数据库中没有头像字段
      contact: String(row.email || row.mobile || ''),
      orgs: row.orgCode ? [String(row.orgCode)] : []
    }));

    console.log('用户数据前10行:', JSON.stringify(userList.slice(0, 10), null, 2));

    return userList;
  } catch (error) {
    console.error('Failed to fetch user list from Qilu database:', error);
    throw new Error('Failed to fetch user list');
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};
