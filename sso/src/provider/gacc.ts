import { RedirectFn, GetUserInfoFn, OrgListType, UserListType, GetUserListFn, GetOrgListFn } from '../type';
import axios from 'axios';
import { UserPrefix } from '../userPrefix';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { json } from 'express';


//基础参数
const viewCode = process.env.VIEW_CODE || 'CCIC_VIEW'
const cus4aUrl = process.env.CUS4A_URL || 'http://cus4a-api.hg.cn/cus4a-identity-read-service'
const searchType = process.env.SEARCH_TYPE || 'false'

//跳转链接的构建参数
const authenticateUrl = process.env.AUTHENTICATE_URL || 'http://cus4a-sso.hg.cn'
const basePath = process.env.BASE_PATH || 'http://19.97.225.13:3000'
const defaultMode = process.env.DEFAULT_MODE || 'windowsauthentication'
const appId = process.env.APP_ID || 'SDKJASDL'
const paramT = process.env.PARAM_T || 'aatoken'
const idMode = process.env.ID_MODE || 'forms'
const slidingTime = process.env.SLIDING_TIME || '0'
const logOffCallBackUrl = process.env.LOG_OFF_CALLBACK_URL || 'http://cus4a-sso.hg.cn/Logout'

//rsa 公钥和密钥，密钥使用的是文件挂载进入docker，公钥作为跳转url的参数
const urlPubkeyConfig = process.env.URL_PUBKEY_CONFIG || ''
const gaccRsaPrivateKeyFilePath = process.env.GACC_RSA_PRIVATE_KEY_FILE || '/run/secrets/gacc_rsa_private_key'

//限制服务范围
const area = ["北京", "黄埔", "杭州"]

// 重定向函数
export const gacc_redirectFn: RedirectFn = async ({ req, redirect_uri, state }) => {
    console.log(`${new Date().toISOString()}[gacc_redirectFn] 开始进行设置ip参数`)
    const ip = req.ip || '127.0.0.1'
    console.log(`${new Date().toISOString()}[gacc_redirectFn] ip为${ip}`)

    console.log(`${new Date().toISOString()}[gacc_redirectFn] 开始进行设置fc参数`)
    let fc = "False"
    if (slidingTime != '0') {
        fc = 'True'
    }
    console.log(`${new Date().toISOString()}[gacc_redirectFn] 开始进行lou链接构造`)
    let lou: string = encodeURIComponent(`${basePath}${logOffCallBackUrl ?? ''}`);
    if (logOffCallBackUrl && logOffCallBackUrl.startsWith('http')) {
        lou = encodeURIComponent(logOffCallBackUrl);
    }
    console.log(`${new Date().toISOString()}[gacc_redirectFn] 开始进行跳转链接构造`)
    const sid = uuidv4()
    const redirectUrl = new URL(authenticateUrl)
    redirectUrl.searchParams.set('aid', appId)
    redirectUrl.searchParams.set('pm', defaultMode)
    redirectUrl.searchParams.set('apk', urlPubkeyConfig)
    redirectUrl.searchParams.set('t', paramT)
    redirectUrl.searchParams.set('lou', lou)
    redirectUrl.searchParams.set('ip', ip)
    redirectUrl.searchParams.set('fciam', "False")
    redirectUrl.searchParams.set("iam", idMode)
    redirectUrl.searchParams.set("ru", encodeURIComponent(redirect_uri))
    redirectUrl.searchParams.set("fc", fc)
    redirectUrl.searchParams.set("sid", sid)

    console.log(`${new Date().toISOString()}[gacc_redirectFn] 跳转链接为${redirectUrl.toString()}`)
    return { redirectUrl: redirectUrl.toString() }
}

export const gacc_getUserInfo: GetUserInfoFn = async (code: string) => {

    console.log(`${new Date().toISOString()}[gacc_getUserInfo] 开始解密RSA加密字符串`)

    // 读取RSA私钥文件
    const privateKey = fs.readFileSync(gaccRsaPrivateKeyFilePath, 'utf8')
    console.log(`${new Date().toISOString()}[gacc_getUserInfo] 成功读取私钥文件`)

    // 使用私钥解密code参数
    const decryptedData = crypto.privateDecrypt(
        {
            key: privateKey,
            padding: crypto.constants.RSA_PKCS1_PADDING
        },
        Buffer.from(code, 'base64')
    )

    const decryptedString = decryptedData.toString('utf8')
    console.log(`${new Date().toISOString()}[gacc_getUserInfo] 解密成功，解密后数据: ${decryptedString}`)


    return {
        username: `${UserPrefix.GACC}-${decryptedString}`,
        avatar: '',
        contact: '',
    }


}

// 获取组织数据
type Department = {
    id: string;
    name: string;
    parentId: string;
}

type UserType = {
    username: string;
    memberName: string;
    avatar?: string;
    contact?: string;
    orgs?: string[];
}

/**
 * 获取指定机构下的人员，只获取一层
 * @param parentGuid 父机构标识
 * @returns Promise<UserType[]> 用户信息数组
 */
const getUserInOrgByParentGuid = async (parentGuid: string): Promise<UserType[]> => {
    try {
        console.log(`${new Date().toISOString()}[getUserInOrgByParentGuid] 获取组织 ${parentGuid} 下的用户`);

        const response = await axios.get(
            `${cus4aUrl}/user-by-parentguid?viewCode=${viewCode}&parentGuid=${parentGuid}&searchType=${searchType}`
        );

        if (response.data.code !== '1') {
            console.error(`${new Date().toISOString()}[getUserInOrgByParentGuid] API返回错误: ${response.data.message}`);
            return [];
        }

        const rawUsers = response.data.data || [];
        console.log(`${new Date().toISOString()}[getUserInOrgByParentGuid] 获取到 ${rawUsers.length} 个用户`);

        // 直接从API响应中提取需要的数据，转换为UserType格式
        const users: UserType[] = rawUsers.map((user: any) => {
            return {
                username: `${UserPrefix.GACC}-${user.userGuid}`, // 使用userGuid作为username
                memberName: user.displayName, // 使用displayName作为memberName
                avatar: '', // API中没有头像信息，设为空字符串
                contact: user.eMail || '', // 使用eMail作为联系方式
                orgs: [parentGuid] // 如果找不到匹配的组织，使用allPathName
            };
        });

        return users;

    } catch (error) {
        console.error(`${new Date().toISOString()}[getUserInOrgByParentGuid] 获取用户信息失败，parentGuid: ${parentGuid}`, error);

        if (axios.isAxiosError(error)) {
            console.error(`${new Date().toISOString()}[getUserInOrgByParentGuid] HTTP错误: ${error.response?.status} ${error.message}`);
        }

        return [];
    }
}

// 初始化根组织对象，提供默认值
let rootDept: Department = {
    id: '',
    name: '',
    parentId: ''
}

let orgList: OrgListType = []

const getRootDept = async (): Promise<void> => {
    try {
        console.log(`${new Date().toISOString()}[getRootDept] 开始获取根组织，URL: ${cus4aUrl}/root-department?searchType=${searchType}&viewCode=${viewCode}`)
        
        const response = await axios.get(`${cus4aUrl}/root-department?searchType=${searchType}&viewCode=${viewCode}`)
        console.log(`${new Date().toISOString()}[getRootDept] API响应状态: ${response.status}`)
        
        
        
       
        
        if (!response.data.data.orgGuid) {
            console.error(`${new Date().toISOString()}[getRootDept] 错误：API返回数据中缺少orgGuid字段`)
            console.error(`${new Date().toISOString()}[getRootDept] 完整响应数据: ${JSON.stringify(response.data)}`)
            throw new Error('API返回数据中缺少orgGuid字段')
        }
        
        // 创建新的根组织对象，确保类型安全
        const newRootDept: Department = {
            id: response.data.data.orgGuid,
            name: response.data.data.displayName,
            parentId: '' // 根组织没有父级
        }
        
        // 一次性赋值，避免中间状态
        rootDept = newRootDept
        
        console.log(`${new Date().toISOString()}[getRootDept] 根组织信息设置完成: ID=${rootDept.id}, Name=${rootDept.name}`)
        
    } catch (error) {
        console.error(`${new Date().toISOString()}[getRootDept] 获取根组织失败:`, error)
        
        if (axios.isAxiosError(error)) {
            console.error(`${new Date().toISOString()}[getRootDept] HTTP错误: ${error.response?.status} ${error.response?.statusText}`)
            if (error.response?.data) {
                console.error(`${new Date().toISOString()}[getRootDept] 错误响应数据: ${JSON.stringify(error.response.data)}`)
            }
        }
        
        throw error
    }
}

/**
 * 递归获取组织结构
 * @param orgGuid 组织GUID
 * @param visited 已访问的组织ID集合，用于防止循环引用
 * @param maxDepth 最大递归深度，防止无限递归
 * @param currentDepth 当前递归深度
 * @returns Promise<Department[]> 组织结构数组
 */
const getOrganizationsByGuidRecursive = async (
    orgGuid: string,
    visited: Set<string> = new Set(),
    maxDepth: number = 50,
    currentDepth: number = 0
): Promise<Department[]> => {
    try {
        // 防止无限递归
        if (currentDepth >= maxDepth) {
            console.warn(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 达到最大递归深度 ${maxDepth}，停止递归`);
            return [];
        }

        // 防止循环引用
        if (visited.has(orgGuid)) {
            console.warn(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 检测到循环引用，跳过组织 ${orgGuid}`);
            return [];
        }

        visited.add(orgGuid);

        console.log(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 获取组织信息，GUID: ${orgGuid}, 深度: ${currentDepth}`);

        const response = await axios.get(
            `${cus4aUrl}/organizations-by-parent-guid?viewCode=${viewCode}&parentGuid=${orgGuid}&searchType=${searchType}`
        );

        if (response.data.code !== '1') {
            console.error(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] API返回错误: ${response.data.message}`);
            return [];
        }

        const organizations: Department[] = [];

        for (const orgData of response.data.data) {
            // 检查allPathName是否包含area数组中的任何地区
            const allPathName = orgData.allPathName || '';
            const shouldInclude = area.some(areaName => allPathName.includes(areaName));

            if (!shouldInclude) {
                console.log(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 跳过组织 ${orgData.displayName}，allPathName: ${allPathName} 不包含指定地区`);
                continue;
            }

            console.log(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 包含组织 ${orgData.displayName}，allPathName: ${allPathName}`);

            // 转换为Department格式
            const department: Department = {
                id: orgData.orgGuid,
                name: orgData.displayName,
                parentId: orgData.parentGuid || rootDept.id,
            };

            organizations.push(department);

            // 如果有子组织，递归获取
            const childrenCount = parseInt(orgData.childrenCount) || 0;
            if (childrenCount > 0) {
                console.log(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 组织 ${orgData.displayName} 有 ${childrenCount} 个子组织，开始递归获取`);

                const childOrganizations = await getOrganizationsByGuidRecursive(
                    orgData.orgGuid,
                    new Set(visited), // 传递visited的副本
                    maxDepth,
                    currentDepth + 1
                );

                organizations.push(...childOrganizations);
            }
        }

        console.log(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 完成组织获取，GUID: ${orgGuid}, 获取到 ${organizations.length} 个组织`);
        return organizations;

    } catch (error) {
        console.error(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] 获取组织信息失败，GUID: ${orgGuid}`, error);

        if (axios.isAxiosError(error)) {
            console.error(`${new Date().toISOString()}[getOrganizationsByGuidRecursive] HTTP错误: ${error.response?.status} ${error.message}`);
        }

        return [];
    }
}

// 并发控制函数：限制同时进行的请求数量，包含错误处理和重试机制
const processBatchWithConcurrencyLimit = async (
    orgBatch: OrgListType,
    concurrentLimit: number,
    maxRetries: number = 3
): Promise<PromiseSettledResult<UserType[]>[]> => {
    const results: PromiseSettledResult<UserType[]>[] = [];

    // 分组处理，每组最多 concurrentLimit 个请求
    for (let i = 0; i < orgBatch.length; i += concurrentLimit) {
        const chunk = orgBatch.slice(i, i + concurrentLimit);

        // 创建Promise数组，包含重试机制
        const promises = chunk.map(async (org) => {
            console.log(`${new Date().toISOString()}[processBatchWithConcurrencyLimit] 获取组织 ${org.name} (${org.id}) 下的用户`);

            // 重试机制
            for (let retry = 0; retry <= maxRetries; retry++) {
                try {
                    const result = await getUserInOrgByParentGuid(org.id);
                    return result;
                } catch (error) {
                    if (retry === maxRetries) {
                        console.error(`${new Date().toISOString()}[processBatchWithConcurrencyLimit] 组织 ${org.name} (${org.id}) 请求失败，已重试 ${maxRetries} 次:`, error);
                        throw error;
                    } else {
                        console.warn(`${new Date().toISOString()}[processBatchWithConcurrencyLimit] 组织 ${org.name} (${org.id}) 请求失败，第 ${retry + 1} 次重试`);
                        // 指数退避延迟
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retry) * 1000));
                    }
                }
            }
            return []; // 这行代码实际不会执行到，但TypeScript需要
        });

        // 等待当前组的所有请求完成
        const chunkResults = await Promise.allSettled(promises);
        results.push(...chunkResults);

        // 添加小延迟以避免过于频繁的请求
        if (i + concurrentLimit < orgBatch.length) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }

    return results;
}

const getOrgListG = async () => {
    try {
        console.log(`${new Date().toISOString()}[getOrgListG] 开始获取完整组织列表`);

        // 首先获取根部门信息
        await getRootDept();

        if (!rootDept.id) {
            throw new Error('无法获取根部门信息');
        }

        console.log(`${new Date().toISOString()}[getOrgListG] 根部门信息: ${rootDept.name} (${rootDept.id})`);

        // 从根部门开始递归获取所有组织
        const allOrganizations = await getOrganizationsByGuidRecursive(rootDept.id);

        // 将根部门添加到结果中
        const completeOrgList: Department[] = [rootDept, ...allOrganizations];

        // 去重处理（基于id）
        const uniqueOrganizations = completeOrgList.filter((org, index, self) =>
            index === self.findIndex(o => o.id === org.id)
        );

        console.log(`${new Date().toISOString()}[getOrgListG] 获取完成，总共 ${uniqueOrganizations.length} 个组织`);

        // 直接更新全局orgList变量
        orgList.length = 0; // 清空现有数组
        orgList.push(...uniqueOrganizations.map(dept => ({
            id: dept.id,
            name: dept.name,
            parentId: dept.parentId
        })));

        console.log(`${new Date().toISOString()}[getOrgListG] 全局orgList已更新，包含 ${orgList.length} 个组织`);

    } catch (error) {
        console.error(`${new Date().toISOString()}[getOrgListG] 获取组织列表失败:`, error);

        if (axios.isAxiosError(error)) {
            throw new Error(`获取组织列表失败: ${error.response?.status} ${error.message}`);
        }

        throw error;
    }
}
export const gacc_getOrgList: GetOrgListFn = async () => {
    try {
        // 如果orgList为空，先获取组织数据
        if (orgList.length === 0) {
            console.log(`${new Date().toISOString()}[gacc_getOrgList] orgList为空，开始获取组织数据`);
            await getOrgListG();
        }

        console.log(`${new Date().toISOString()}[gacc_getOrgList] 返回组织列表，包含 ${orgList.length} 个组织`);
        return orgList;
    } catch (error) {
        console.error(`${new Date().toISOString()}[gacc_getOrgList] 获取组织列表失败:`, error);
        throw error;
    }
}

export const gacc_getUserList: GetUserListFn = async () => {
    try {
        console.log(`${new Date().toISOString()}[gacc_getUserList] 开始获取用户列表`);

        // 确保组织列表已加载
        await getOrgListG();

        if (orgList.length === 0) {
            console.warn(`${new Date().toISOString()}[gacc_getUserList] 组织列表为空，无法获取用户`);
            return [];
        }

        console.log(`${new Date().toISOString()}[gacc_getUserList] 开始并发获取 ${orgList.length} 个组织的用户`);

        // 并发控制参数
        const BATCH_SIZE = 10; // 每批处理的组织数量，控制内存占用
        const CONCURRENT_LIMIT = 5; // 同时进行的请求数量限制

        const allUsers: UserType[] = []; // 先收集所有用户，不去重

        // 分批处理组织列表以控制内存占用
        for (let i = 0; i < orgList.length; i += BATCH_SIZE) {
            const batch = orgList.slice(i, i + BATCH_SIZE);
            console.log(`${new Date().toISOString()}[gacc_getUserList] 处理第 ${Math.floor(i / BATCH_SIZE) + 1} 批组织 (${batch.length} 个)`);

            // 使用并发控制的Promise处理
            const batchResults = await processBatchWithConcurrencyLimit(batch, CONCURRENT_LIMIT);

            // 收集本批次的用户数据
            for (const result of batchResults) {
                if (result.status === 'fulfilled' && result.value.length > 0) {
                    allUsers.push(...result.value);
                } else if (result.status === 'rejected') {
                    console.error(`${new Date().toISOString()}[gacc_getUserList] 批次请求失败:`, result.reason);
                }
            }

            // 强制垃圾回收（如果可用）
            if (global.gc) {
                global.gc();
            }
        }

        console.log(`${new Date().toISOString()}[gacc_getUserList] 并发处理完成，共收集到 ${allUsers.length} 个用户记录`);

        // 现在进行去重并合并用户信息（不使用分批处理，避免竞态条件）
        const userMap = new Map<string, UserType>();

        // 直接遍历所有用户进行去重
        for (const user of allUsers) {
            if (user.username) {
                if (userMap.has(user.username)) {
                    // 用户已存在，合并用户信息
                    const existingUser = userMap.get(user.username)!;
                    
                    // 合并组织信息，去重
                    if (user.orgs && user.orgs.length > 0) {
                        existingUser.orgs = existingUser.orgs || [];
                        const orgSet = new Set([...existingUser.orgs, ...user.orgs]);
                        existingUser.orgs = Array.from(orgSet);
                    }
                    
                    
                    console.log(`${new Date().toISOString()}[gacc_getUserList] 合并重复用户: ${user.username}, 组织数量: ${existingUser.orgs?.length || 0}`);
                } else {
                    // 新用户，直接添加
                    userMap.set(user.username, user);
                }
            }
        }

        // 清理原始用户数组以释放内存
        allUsers.length = 0;

        // 将map中的用户转换为数组
        const userList = Array.from(userMap.values());
        console.log(`${new Date().toISOString()}[gacc_getUserList] 去重后共获取到 ${userList.length} 个用户`);

        return userList;

    } catch (error) {
        console.error(`${new Date().toISOString()}[gacc_getUserList] 获取用户列表失败:`, error);
        throw error;
    }
}