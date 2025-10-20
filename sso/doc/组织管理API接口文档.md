# 组织管理API接口文档

## 1. 根据组织ID查询组织信息

### 接口描述
查询指定组织的基本信息

### 请求信息
- **请求方式**: POST
- **请求URL**: `https://ipaas-test.cethik.com/api/MDM/HdQueryPageOrgFast`
- **请求头**:
  - `Authorization`: FL737zD3012ff147307c4Vs7767l6s3l
  - `Content-Type`: application/json

### 请求参数
```json
{
  "orgCode": "1001"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| orgCode | string | 是 | 组织编码 |

### 返回示例
```json
{
  "success": true,
  "message": "查询成功",
  "orgList": [
    {
      "id": "1001",
      "name": "xxx",
      "parentId": ""
    }
  ],
  "code": "00000"
}
```

### 返回参数说明
| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 返回消息 |
| orgList | array | 组织信息列表 |
| orgList[].id | string | 组织ID |
| orgList[].name | string | 组织名称 |
| orgList[].parentId | string | 父组织ID |
| code | string | 响应码 |

---

## 2. 根据组织ID分页查询部门数据

### 接口描述
分页查询指定组织下的部门信息

### 请求信息
- **请求方式**: POST
- **请求URL**: `https://ipaas-test.cethik.com/api/MDM/HdQueryPageDeptFast`
- **请求头**:
  - `Authorization`: FL737zD3012ff147307c4Vs7767l6s3l
  - `Content-Type`: application/json

### 请求参数
```json
{
  "page": 0,
  "size": 100,
  "orgCode": "1001"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 是 | 页码，从0开始 |
| size | number | 是 | 每页大小 |
| orgCode | string | 是 | 组织编码 |

### 返回示例
```json
{
  "success": true,
  "message": "查询成功",
  "totalElements": 80,
  "totalPages": 40,
  "orgList": [
    {
      "id": "100008",
      "name": "xx部1",
      "parentId": "100007"
    },
    {
      "id": "100010",
      "name": "xx部2",
      "parentId": "1001"
    }
  ],
  "code": "00000"
}
```

### 返回参数说明
| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 返回消息 |
| totalElements | number | 总记录数 |
| totalPages | number | 总页数 |
| orgList | array | 部门信息列表 |
| orgList[].id | string | 部门ID |
| orgList[].name | string | 部门名称 |
| orgList[].parentId | string | 父部门ID |
| code | string | 响应码 |

---

## 3. 根据组织ID分页查询人员数据

### 接口描述
分页查询指定组织下的人员信息

### 请求信息
- **请求方式**: POST
- **请求URL**: `https://ipaas-test.cethik.com/api/MDM/HdQueryPageInstituteFast`
- **请求头**:
  - `Authorization`: FL737zD3012ff147307c4Vs7767l6s3l
  - `Content-Type`: application/json

### 请求参数
```json
{
  "page": 0,
  "size": 100,
  "orgCode": "1001"
}
```

| 参数名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| page | number | 是 | 页码，从0开始 |
| size | number | 是 | 每页大小 |
| orgCode | string | 是 | 组织编码 |

### 返回示例
```json
{
  "success": true,
  "message": "查询成功",
  "totalElements": 109,
  "totalPages": 55,
  "userList": [
    {
      "username": "lisi",
      "memberName": "李四",
      "orgs": [
        "100016"
      ]
    },
    {
      "username": "zhangsan",
      "memberName": "张三",
      "orgs": [
        "100016"
      ]
    }
  ],
  "code": "00000"
}
```

### 返回参数说明
| 参数名 | 类型 | 说明 |
|--------|------|------|
| success | boolean | 请求是否成功 |
| message | string | 返回消息 |
| totalElements | number | 总记录数 |
| totalPages | number | 总页数 |
| userList | array | 用户信息列表 |
| userList[].username | string | 用户名 |
| userList[].memberName | string | 用户姓名 |
| userList[].orgs | array | 所属组织ID列表 |
| code | string | 响应码 |

---

## 通用说明

### 认证方式
所有接口均使用固定的Authorization头进行认证：
```
Authorization: FL737zD3012ff147307c4Vs7767l6s3l
```

### 响应码说明
- `00000`: 成功
- 其他: 失败（具体错误码含义需要根据实际业务定义）

### 环境信息
- 测试环境: `https://ipaas-test.cethik.com`

### 使用示例

#### 查询组织信息
```bash
curl --request POST \
  --url https://ipaas-test.cethik.com/api/MDM/HdQueryPageOrgFast \
  --header 'Authorization: FL737zD3012ff147307c4Vs7767l6s3l' \
  --header 'Content-Type: application/json' \
  --data '{
    "orgCode": "1001"
  }'
```

#### 查询部门数据
```bash
curl --request POST \
  --url https://ipaas-test.cethik.com/api/MDM/HdQueryPageDeptFast \
  --header 'Authorization: FL737zD3012ff147307c4Vs7767l6s3l' \
  --header 'Content-Type: application/json' \
  --data '{
    "page": 0,
    "size": 100,
    "orgCode": "1001"
  }'
```

#### 查询人员数据
```bash
curl --request POST \
  --url https://ipaas-test.cethik.com/api/MDM/HdQueryPageInstituteFast \
  --header 'Authorization: FL737zD3012ff147307c4Vs7767l6s3l' \
  --header 'Content-Type: application/json' \
  --data '{
    "page": 0,
    "size": 100,
    "orgCode": "1001"
  }'
```